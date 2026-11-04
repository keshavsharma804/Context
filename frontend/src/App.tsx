import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useHotkeys } from "react-hotkeys-hook";

import { AmbientBackground } from "./components/AmbientBackground";
import { RouteProgress } from "./components/RouteProgress";
import Shell from "./components/Shell";
import ThemedToaster from "./components/ThemedToaster";
import FloatingAsk from "./components/FloatingAsk";
import { TourManager } from "./components/tour";
import Dashboard from "./pages/Dashboard";
import AuthPage from "./pages/AuthPage";
import { pageTransition } from "./lib/animations";
import { preloadSounds } from "./hooks/useSound";
import { useAutoThemeScheduler } from "./hooks/useAutoThemeScheduler";
import { useAuthStore } from './store/auth';
import { useUIStore } from './store/ui';
import { lastSectionKey, safeStartPath } from './lib/start-page';

const Money = lazy(() => import('./pages/Money'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Debts = lazy(() => import('./pages/Debts'));
const Savings = lazy(() => import('./pages/Savings'));
const Review = lazy(() => import('./pages/Review'));
const Journal = lazy(() => import('./pages/Journal'));
const People = lazy(() => import('./pages/People'));
const PersonDetail = lazy(() => import('./pages/PersonDetail'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Vault = lazy(() => import('./pages/Vault'));
const Email = lazy(() => import('./pages/Email'));
const Jobs = lazy(() => import('./pages/Jobs'));
const Files = lazy(() => import('./pages/Files'));
const Settings = lazy(() => import('./pages/Settings'));
const GlobalSearch = lazy(() => import('./pages/GlobalSearch'));
const NoteDetail = lazy(() => import('./pages/NoteDetail'));
const RecordDetail = lazy(() => import('./pages/RecordDetail'));
const QuickCapture = lazy(() => import('./components/QuickCapture'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));
const ShortcutsOverlay = lazy(() => import('./components/ShortcutsOverlay'));

function AutoThemeWatcher() {
  useAutoThemeScheduler();
  return null;
}

const queryClient: QueryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (data, _variables, _context, mutation) => {
      const key = mutation.options.mutationKey;
      const captureKind = (data as { kind?: string } | undefined)?.kind;
      const changesReminders = key?.[0] !== 'notes' && !(key?.[0] === 'capture' &&
        (key[1] === 'preview' || !['event', 'debt', 'subscription'].includes(captureKind || '')));
      if (key?.[0] !== 'notifications' && changesReminders) {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// The public preview never requests private account data or runs background refetches.
const previewClient = new QueryClient({ defaultOptions: { queries: { enabled: false } } });

export function GuestWelcome() {
  const [show, setShow] = useState(() => {
    try { return localStorage.getItem('context:tour_completed') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    let timer: number | undefined;
    const finished = () => { timer = window.setTimeout(() => setShow(true), 1200); };
    window.addEventListener('context:tour-closed', finished);
    return () => { window.removeEventListener('context:tour-closed', finished); window.clearTimeout(timer); };
  }, []);
  if (!show) return null;
  return <div className="mx-auto w-full max-w-7xl px-6 lg:px-8"><div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/25 bg-card p-5" role="region" aria-label="Welcome to Context">
    <div className="min-w-0 flex-1"><p className="font-semibold">Make this dashboard yours</p><p className="text-sm text-muted-foreground">Create an account or sign in to save your data and connect your personal AI and Gmail.</p></div>
    <Link className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" to="/auth?mode=signup">Create Account</Link>
    <Link className="rounded-xl border border-border px-4 py-2 text-sm" to="/auth">Sign In</Link>
    <button type="button" className="px-2 py-2 text-sm text-muted-foreground" onClick={() => setShow(false)}>Maybe later</button>
  </div></div>;
}

function SessionBoundary() {
  const initialized = useAuthStore(state => state.initialized);
  const user = useAuthStore(state => state.user);
  const opensOn = useUIStore(state => state.opensOn);
  const location = useLocation();
  const navigate = useNavigate();
  const restoredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user) { restoredFor.current = null; return; }
    if (location.pathname === '/auth') return;
    const key = lastSectionKey(user.id);
    try {
      if (restoredFor.current !== user.id) {
        restoredFor.current = user.id;
        if (location.pathname === '/' && opensOn === 'last') {
          const target = safeStartPath(localStorage.getItem(key));
          if (target !== '/') { navigate(target, { replace: true }); return; }
        }
      }
      localStorage.setItem(key, safeStartPath(location.pathname + location.search));
    } catch { /* Preferences are optional when browser storage is unavailable. */ }
  }, [user, location.pathname, location.search, opensOn, navigate]);

  if (!initialized) return null;
  if (location.pathname === '/auth') return <AuthPage />;
  if (!user) {
    if (location.pathname !== '/') return <Navigate replace to={`/auth?next=${encodeURIComponent(location.pathname + location.search)}`} />;
    return <QueryClientProvider client={previewClient}>
      <Shell key="preview"><GuestWelcome /><Dashboard preview /></Shell>
    </QueryClientProvider>;
  }
  return <>
    <Shell key={user.id}><AnimatedRoutes /></Shell>
    <FloatingAsk />
    <GlobalShortcuts />
  </>;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={location.pathname}
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
        className="min-h-full"
      >
        <Suspense fallback={<div role="status" className="p-8 text-sm text-muted-foreground">Loading page…</div>}>
          <Routes location={location}>
            <Route path="/" element={<HomeEntry />} />
            <Route path="/search" element={<GlobalSearch />} />
            <Route path="/notes/:id" element={<NoteDetail />} />
            <Route path="/records/:kind/:id" element={<RecordDetail />} />
            <Route path="/money" element={<Money />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/debts" element={<Debts />} />
            <Route path="/savings" element={<Savings />} />
            <Route path="/review" element={<Review />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/people" element={<People />} />
            <Route path="/people/:name" element={<PersonDetail />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/vault" element={<Vault />} />
            <Route path="/email" element={<Email />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/files" element={<Files />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/auth" element={<AuthPage />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function HomeEntry() {
  const location = useLocation();
  const q = new URLSearchParams(location.search).get('q');
  return q ? <Navigate replace to={`/search?q=${encodeURIComponent(q)}`} /> : <Dashboard />;
}

const CHORDS: Record<string, string> = {
  d: "/",
  m: "/money",
  r: "/subscriptions",
  b: "/debts",
  g: "/savings",
  w: "/review",
  l: "/journal",
  p: "/people",
  c: "/calendar",
  v: "/vault",
  e: "/email",
  j: "/jobs",
  f: "/files",
  s: "/settings",
  '/': '/search',
};

function GlobalShortcuts() {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const closeCapture = useCallback(() => setCaptureOpen(false), []);
  const gPressed = useRef(false);
  const gTimer = useRef<number | null>(null);

  const closeAll = () => {
    setPaletteOpen(false);
    setShortcutsOpen(false);
    setCaptureOpen(false);
    window.dispatchEvent(new Event("context:escape"));
  };

  useHotkeys(
    "mod+k",
    (event) => {
      event.preventDefault();
      setShortcutsOpen(false);
      setPaletteOpen((open) => !open);
    },
    { preventDefault: true, enableOnFormTags: true }
  );

  useHotkeys(
    "mod+j",
    (event) => {
      event.preventDefault();
      setPaletteOpen(false);
      window.dispatchEvent(new Event("context:toggle-ask"));
    },
    { preventDefault: true, enableOnFormTags: true }
  );

  useHotkeys("escape", () => closeAll(), { enableOnFormTags: true });

  useEffect(() => {
    const open = () => { setPaletteOpen(false); setShortcutsOpen(false); setCaptureOpen(true); };
    window.addEventListener('context:quick-capture', open);
    return () => window.removeEventListener('context:quick-capture', open);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const typing =
        target instanceof Element &&
        Boolean(
          target.closest("input, textarea, select, [contenteditable='true']")
        );

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (!typing && event.key === "?") {
        event.preventDefault();
        setPaletteOpen(false);
        setShortcutsOpen((open) => !open);
        return;
      }

      if (typing) {
        gPressed.current = false;
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "g") {
        gPressed.current = true;
        if (gTimer.current) window.clearTimeout(gTimer.current);
        gTimer.current = window.setTimeout(() => {
          gPressed.current = false;
        }, 1000);
        return;
      }

      if (gPressed.current) {
        const to = CHORDS[key];
        gPressed.current = false;
        if (gTimer.current) window.clearTimeout(gTimer.current);
        if (to) {
          event.preventDefault();
          navigate(to);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (gTimer.current) window.clearTimeout(gTimer.current);
    };
  }, [navigate]);

  return (
    <>
      <Suspense fallback={null}>
        {captureOpen && <QuickCapture onClose={closeCapture} />}
        {paletteOpen && <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />}
        {shortcutsOpen && <ShortcutsOverlay
          open={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
        />}
      </Suspense>
    </>
  );
}

export default function App() {
  const initialized = useAuthStore(state => state.initialized);
  useEffect(() => {
    const clear = () => queryClient.clear();
    const expire = () => { if (useAuthStore.getState().isAuthenticated) useAuthStore.getState().expire(); };
    const syncTabs = (event: StorageEvent) => {
      if (event.key === 'context:auth-revision') void useAuthStore.getState().initialize(true);
    };
    window.addEventListener('context:auth-changing', clear);
    window.addEventListener('context:session-expired', expire);
    window.addEventListener('storage', syncTabs);
    void useAuthStore.getState().initialize();
    return () => {
      window.removeEventListener('context:auth-changing', clear);
      window.removeEventListener('context:session-expired', expire);
      window.removeEventListener('storage', syncTabs);
    };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => preloadSounds(), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <AutoThemeWatcher />
          <AmbientBackground />
          <RouteProgress />
          <TourManager ready={initialized}><SessionBoundary /></TourManager>
          <ThemedToaster />
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  );
}
