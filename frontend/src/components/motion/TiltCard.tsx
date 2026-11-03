import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useRef, type ReactNode, type MouseEvent } from "react";

interface Props {
    children: ReactNode;
    className?: string;
    intensity?: number;
}

export function TiltCard({ children, className = "", intensity = 4 }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const mx = useMotionValue(0.5);
    const my = useMotionValue(0.5);
    const rotateX = useSpring(
        useTransform(my, [0, 1], [intensity, -intensity]),
        { stiffness: 300, damping: 25 }
    );
    const rotateY = useSpring(
        useTransform(mx, [0, 1], [-intensity, intensity]),
        { stiffness: 300, damping: 25 }
    );

    const onMove = (e: MouseEvent) => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
    };
    const onLeave = () => {
        mx.set(0.5);
        my.set(0.5);
    };

    return (
        <motion.div
            ref={ref}
            style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
            className={className}
        >
            {children}
        </motion.div>
    );
}