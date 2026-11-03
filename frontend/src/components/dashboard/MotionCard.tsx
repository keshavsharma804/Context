import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "../../lib/utils";
import { cardEnter, spring } from "../../lib/animations";
import { useSound } from "../../hooks/useSound";
import { useCallback, useRef } from "react";

interface MotionCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  disableHover?: boolean;
}

export function MotionCard({
  children,
  className,
  disableHover = false,
  ...rest
}: MotionCardProps) {
  const playHover = useSound("click");
  const hoveredRef = useRef(false);

  const handleEnter = useCallback(() => {
    if (!hoveredRef.current && !disableHover) {
      hoveredRef.current = true;
      playHover();
    }
  }, [playHover, disableHover]);

  return (
    <motion.div
      variants={cardEnter}
      whileHover={
        disableHover
          ? undefined
          : {
            scale: 1.005,
            y: -2,
            transition: spring.gentle,
          }
      }
      onHoverStart={handleEnter}
      className={cn(
        "rounded-2xl border border-border/70 bg-card/75 backdrop-blur-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.35),inset_0_1px_0_0_rgba(255,255,255,0.07)] light:shadow-[0_2px_12px_rgba(0,0,0,0.05),inset_0_1px_0_0_rgba(255,255,255,0.9)] will-change-transform transition-all duration-200 hover:border-border hover:shadow-[0_10px_32px_-8px_hsl(var(--primary)/0.2),inset_0_1px_0_0_rgba(255,255,255,0.12)]",
        className
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}