import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, X, Check } from "lucide-react";
import { MotionCard } from "./MotionCard";
import CardHeading from "./CardHeading";
import { PulseDot } from "../motion/PulseDot";
import { CountUp } from "../motion/CountUp";
import { useSound, playSound } from "../../hooks/useSound";

import { useQueryClient } from "@tanstack/react-query";
import { itemEnter, spring, staggerContainer } from "../../lib/animations";

interface Pattern {
  id: number;
  kind: string;
  title: string;
  detail: string;
  severity: "warn" | "danger" | "info";
}

interface Props {
  patterns: { count: number; patterns: Pattern[] };
}

const SEVERITY_STYLES: Record<string, string> = {
  warn: "border-l-amber-500 bg-amber-500/[0.03] hover:shadow-[inset_3px_0_0_0_#f59e0b]",
  danger:
    "border-l-red-500 bg-red-500/[0.03] hover:shadow-[inset_3px_0_0_0_#ef4444]",
  info: "border-l-blue-500 bg-blue-500/[0.03] hover:shadow-[inset_3px_0_0_0_#3b82f6]",
};

export function PatternsCard({ patterns }: Props) {
  const qc = useQueryClient();
  const playSwoosh = useSound("swoosh");
  const playChime = useSound("chime");
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [handled, setHandled] = useState<{ id: number; title: string } | null>(
    null
  );
  const [pulse, setPulse] = useState(false);
  const previousCount = useRef<number | null>(null);

  // Bell + scale pulse when a refresh detects new patterns.
  useEffect(() => {
    let stored: number | null = null;
    try {
      const raw = localStorage.getItem("context:patterns-count");
      stored = raw === null ? null : Number(raw);
      localStorage.setItem("context:patterns-count", String(patterns.count));
    } catch {
      // storage unavailable
    }

    if (previousCount.current === null) {
      previousCount.current = stored ?? patterns.count;
      if (stored !== null && patterns.count > stored) {
        playSound("bell");
        setPulse(true);
        window.setTimeout(() => setPulse(false), 700);
      }
      return;
    }

    if (patterns.count > previousCount.current) {
      playSound("bell");
      setPulse(true);
      window.setTimeout(() => setPulse(false), 700);
    }
    previousCount.current = patterns.count;
  }, [patterns.count]);

  const handleDismiss = async (pattern: Pattern) => {
    playSwoosh();
    setDismissed((d) => [...d, pattern.id]);
    setHandled({ id: pattern.id, title: pattern.title });
    window.setTimeout(() => setHandled(null), 950);
    try {
      await fetch("/api/patterns/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pattern.id }),
      });
      qc.invalidateQueries({ queryKey: ["home"] });
      playChime();
    } catch {
      setDismissed((d) => d.filter((x) => x !== pattern.id));
    }
  };

  const visible = patterns.patterns.filter((p) => !dismissed.includes(p.id));

  if (patterns.count === 0 || visible.length === 0) {
    return (
      <MotionCard>
        <div className="p-5">
          <CardHeading icon={Search} title="Patterns" />
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-primary/60"
                  animate={{ y: [0, -4, 0] }}
                  transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    delay: i * 0.15,
                  }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Still learning your patterns...
            </p>
          </div>
        </div>
      </MotionCard>
    );
  }

  return (
    <MotionCard className="relative overflow-hidden">
      <motion.div
        animate={pulse ? { scale: [1, 1.02, 1] } : { scale: 1 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="p-5">
          <div className="flex items-center gap-2">
            <CardHeading icon={Search} title="Patterns I noticed" />
            <PulseDot color="bg-amber-500" size="w-1.5 h-1.5" />
            <span className="text-xs tabular-nums text-muted-foreground">
              <CountUp value={visible.length} duration={0.6} />
            </span>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="mt-3 space-y-2 relative"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((p) => (
                <motion.div
                  key={p.id}
                  variants={itemEnter}
                  layout
                  exit={{ opacity: 0, height: 0, marginTop: 0, x: -12 }}
                  transition={{ ...spring.gentle, opacity: { duration: 0.18 } }}
                  className={`relative group overflow-hidden rounded-lg border-l-2 px-3 py-2.5 transition-shadow duration-200 ${
                    SEVERITY_STYLES[p.severity] || SEVERITY_STYLES.info
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">
                        {p.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {p.detail}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 4 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDismiss(p)}
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-secondary/60 hover:text-foreground group-hover:opacity-100"
                      title="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            <AnimatePresence>
              {handled && (
                <motion.div
                  key={handled.id}
                  initial={{ opacity: 0, y: 4, scale: 0.9 }}
                  animate={{ opacity: 1, y: -26, scale: 1 }}
                  exit={{ opacity: 0, y: -40 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="pointer-events-none absolute right-3 top-4 z-10 flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500 backdrop-blur"
                >
                  <Check className="h-3 w-3" /> handled
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.div>
    </MotionCard>
  );
}
