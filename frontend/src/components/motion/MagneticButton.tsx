import { motion, useMotionValue, useSpring } from "motion/react";
import { useRef, type ReactNode, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

interface Props {
    children: ReactNode;
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
    intensity?: number;
    type?: "button" | "submit" | "reset";
    "aria-label"?: string;
}

export function MagneticButton({
    children,
    onClick,
    className = "",
    disabled,
    intensity = 0.15,
    type = "button",
    "aria-label": ariaLabel,
}: Props) {
    const ref = useRef<HTMLButtonElement>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const sx = useSpring(x, { stiffness: 300, damping: 20 });
    const sy = useSpring(y, { stiffness: 300, damping: 20 });

    const handleMove = (e: MouseEvent) => {
        if (disabled || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        x.set((e.clientX - rect.left - rect.width / 2) * intensity);
        y.set((e.clientY - rect.top - rect.height / 2) * intensity);
    };

    const handleLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.button
            ref={ref}
            type={type}
            aria-label={ariaLabel}
            style={{ x: sx, y: sy }}
            whileHover={disabled ? undefined : { scale: 1.02 }}
            whileTap={disabled ? undefined : { scale: 0.96 }}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
            onClick={onClick}
            disabled={disabled}
            className={cn("relative overflow-hidden", className)}
        >
            {children}
        </motion.button>
    );
}
