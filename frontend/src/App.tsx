import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useHotkeys } from "react-hotkeys-hook";

import { AmbientBackground } from "./components/AmbientBackground";
import { RouteProgress } from "./components/RouteProgress";
import Shell from "./components/Shell";
import ThemedToaster from "./components/ThemedToaster";
import FloatingAsk from "./components/FloatingAsk";
import CommandPalette from "./components/CommandPalette";
import ShortcutsOverlay from "./components/ShortcutsOverlay";
import { TourManager } from "./components/tour";
import Dashboard from "./pages/Dashboard";
import Money from "./pages/Money";
import Subscriptions from "./pages/Subscriptions";
import Debts from "./pages/Debts";
import Savings from "./pages/Savings";
import Review from "./pages/Review";
import Journal from "./pages/Journal";
import People from "./pages/People";
import PersonDetail from "./pages/PersonDetail";
import Calendar from "./pages/Calendar";
import Vault from "./pages/Vault";
import Email from "./pages/Email";
import Jobs from "./pages/Jobs";
import Files from "./pages/Files";
import Settings from "./pages/Settings";
import AuthPage from "./pages/AuthPage";
import { pageTransition } from "./lib/animations";
import { preloadSounds } from "./hooks/useSound";
import { useAutoThemeScheduler } from "./hooks/useAutoThemeScheduler";

function AutoThemeWatcher() {
  useAutoThemeScheduler();
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

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
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
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
      </motion.div>
    </AnimatePresence>
  );
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
};

function GlobalShortcuts() {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const gPressed = useRef(false);
  const gTimer = useRef<number | null>(null);

  const closeAll = () => {
    setPaletteOpen(false);
    setShortcutsOpen(false);
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
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </>
  );
}

export default function App() {
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
          <Shell>
            <AnimatedRoutes />
          </Shell>
          <FloatingAsk />
          <GlobalShortcuts />
          <TourManager />
          <ThemedToaster />
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  );
}
