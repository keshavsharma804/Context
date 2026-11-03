import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Plus,
  X,
} from "lucide-react";
import type { SpendBrief } from "@/lib/api";
import { postMoneyAdd } from "@/lib/api";
import { MotionCard } from "./MotionCard";
import CardHeading from "./CardHeading";
import { CountUp } from "../motion/CountUp";
import { SpinnerArc } from "../motion/SpinnerArc";
import { Button } from "../ui/button";
import { itemEnter, spring, staggerContainer } from "../../lib/animations";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useSound } from "../../hooks/useSound";
import { celebrateSpend } from "../../lib/celebrate";

const EMPTY: SpendBrief = {
  week_total: 0,
  week_by_category: [],
  month_total: 0,
  budgets: [],
  compare: { this_total: 0, last_total: 0, change_pct: 0 },
  leaks: [],
};

interface Props {
  spend?: SpendBrief;
  symbol?: string;
}

export function MoneyCard({ spend = EMPTY, symbol = "₹" }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reduced = useReducedMotion();
  const playChime = useSound("chime");
  const playThud = useSound("thud");
  const loggedOverBudget = useRef(false);

  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  // Empty until the API categories arrive; the effect below selects the first.
  const [category, setCategory] = useState("");
  const [coin, setCoin] = useState<number | null>(null);

  const maxCat = useMemo(
    () => Math.max(1, ...spend.week_by_category.map((c) => c.total)),
    [spend.week_by_category]
  );

  // Categories come from the API, never from a hardcoded list.
  const categories = useMemo(() => {
    const found = new Set(spend.categories ?? []);
    spend.week_by_category.forEach((item) => found.add(item.category));
    spend.budgets.forEach((item) => found.add(item.category));
    if (found.size === 0) found.add("other");
    return Array.from(found).sort((a, b) => a.localeCompare(b));
  }, [spend.categories, spend.week_by_category, spend.budgets]);

  useEffect(() => {
    if (!categories.includes(category)) setCategory(categories[0]);
  }, [categories, category]);

  const changePositive = spend.compare.change_pct > 0;
  const overBudget = spend.budgets.some((b) => b.over || b.percent >= 100);

  useEffect(() => {
    if (overBudget && !loggedOverBudget.current) {
      loggedOverBudget.current = true;
      playThud();
    }
  }, [overBudget, playThud]);

  const addSpend = useMutation({
    mutationFn: () =>
      postMoneyAdd(Number(amount), merchant.trim() || "Quick add", category),
    onSuccess: () => {
      playChime();
      celebrateSpend();
      setCoin(Date.now());
      window.setTimeout(() => setCoin(null), 1100);
      toast.success("Spend added");
      queryClient.invalidateQueries({ queryKey: ["home"] });
      setAmount("");
      setMerchant("");
      setAdding(false);
    },
    onError: (error) => {
      playThud();
      toast.error(error instanceof Error ? error.message : "Could not add spend");
    },
  });

  return (
    <MotionCard
      className={overBudget ? "budget-alert" : undefined}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <CardHeading icon={Wallet} title="Money" className="px-0 pt-0" />
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setAdding((value) => !value)}
              aria-label={adding ? "Close quick add" : "Add a spend"}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-surface-2 text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              {adding ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            </motion.button>
            <button
              onClick={() => navigate("/money")}
              className="link-underline flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="mt-5 grid items-center gap-4 sm:grid-cols-2 sm:gap-6">
          <div className="min-w-0">
          <div className="relative flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <motion.span
              layoutId="money-total"
              className="text-3xl font-semibold tracking-tight tabular-nums"
            >
              <CountUp value={spend.week_total} prefix={symbol} decimals={0} />
            </motion.span>
            <span className="text-xs text-muted-foreground">this week</span>

            <AnimatePresence>
              {coin !== null && (
                <motion.span
                  key={coin}
                  initial={{ opacity: 0, y: 10, scale: 0.5 }}
                  animate={{ opacity: [0, 1, 1, 0], y: -26, scale: [0.5, 1.15, 1, 0.9] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1 }}
                  className="pointer-events-none absolute left-16 top-0 text-sm font-semibold text-amber-400"
                >
                  {symbol}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          {spend.compare.last_total > 0 && (
            <div
              className={`mt-1 flex items-center gap-1 text-xs ${
                changePositive ? "text-destructive" : "text-emerald-500"
              }`}
            >
              {changePositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>
                {changePositive ? "+" : ""}
                {spend.compare.change_pct}% vs last week
              </span>
            </div>
          )}
          </div>
          {spend.week_total === 0 && spend.week_by_category.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-1 p-4">
              <p className="text-sm font-medium">No expenses this week</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Add an expense to start tracking your spending.</p>
              {!adding && <button type="button" onClick={() => setAdding(true)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                <Plus className="h-3.5 w-3.5" /> Add expense
              </button>}
            </div>
          ) : (
            <div className="border-t border-border/50 pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
              <p className="text-xs text-muted-foreground">This month</p>
              <p className="mt-1 text-xl font-semibold tabular-nums"><CountUp value={spend.month_total} prefix={symbol} decimals={0} /></p>
            </div>
          )}
        </div>

        <AnimatePresence initial={false}>
          {adding && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring.gentle}
              onSubmit={(event) => {
                event.preventDefault();
                if (!amount || Number(amount) <= 0 || addSpend.isPending) return;
                addSpend.mutate();
              }}
              className="mt-3 overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-surface-inset p-2">
                <span className="pl-1 text-xs text-muted-foreground">{symbol}</span>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="250"
                  aria-label="Amount"
                  className="w-16 bg-transparent text-xs tabular-nums outline-none placeholder:text-muted-foreground/40"
                />
                <input
                  value={merchant}
                  onChange={(event) => setMerchant(event.target.value)}
                  placeholder="coffee"
                  aria-label="Merchant"
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/40"
                />
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  aria-label="Category"
                  className="rounded bg-surface-2 px-1 py-0.5 text-[10px] text-muted-foreground outline-none"
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <Button
                  type="submit"
                  size="iconSm"
                  aria-label="Add spend"
                  disabled={!amount || Number(amount) <= 0 || addSpend.isPending}
                  className="h-6 w-6"
                  sound={false}
                >
                  {addSpend.isPending ? (
                    <SpinnerArc className="h-3 w-3" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {spend.week_by_category.length > 0 && (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="mt-4 space-y-2"
          >
            {spend.week_by_category.slice(0, 4).map((c, index) => {
              const pct = (c.total / maxCat) * 100;
              return (
                <motion.div key={c.category} variants={itemEnter}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="capitalize text-muted-foreground">
                      {c.category}
                    </span>
                    <span className="tabular-nums font-medium">
                      {symbol}
                      {c.total.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{
                        ...spring.gentle,
                        delay: reduced ? 0 : 0.25 + index * 0.1,
                      }}
                      className="bar-sheen relative h-full overflow-hidden rounded-full bg-gradient-to-r from-primary to-primary/60"
                    />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {spend.budgets.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-border/40 pt-3">
            {spend.budgets.slice(0, 2).map((b) => (
              <div key={b.category}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="capitalize text-muted-foreground">
                    {b.category} budget
                  </span>
                  <span
                    className={
                      b.over || b.percent >= 100
                        ? "text-destructive font-medium"
                        : "text-muted-foreground"
                    }
                  >
                    {symbol}
                    {b.spent.toLocaleString("en-IN")} / {symbol}
                    {b.budget.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-secondary/60 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(b.percent, 100)}%` }}
                    transition={{
                      ...spring.gentle,
                      delay: reduced ? 0 : 0.45,
                    }}
                    className={`h-full rounded-full ${
                      b.over || b.percent >= 100
                        ? "bg-destructive"
                        : "bg-emerald-500"
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MotionCard>
  );
}
