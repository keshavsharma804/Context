import { useEffect, useState } from "react";
import { useMotionValue, useTransform, animate } from "motion/react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface Props {
    value: number;
    duration?: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
}

function format(value: number, decimals: number) {
    const fixed = value.toFixed(decimals);
    return Number(fixed).toLocaleString("en-IN");
}

export function CountUp({
    value,
    duration = 1.2,
    prefix = "",
    suffix = "",
    decimals = 0,
}: Props) {
    const reduced = useReducedMotion();
    const count = useMotionValue(0);
    const rounded = useTransform(count, (latest) =>
        format(Number(latest), decimals)
    );
    const [display, setDisplay] = useState(reduced ? format(value, decimals) : "0");

    useEffect(() => {
        if (reduced) {
            count.set(value);
            setDisplay(format(value, decimals));
            return;
        }

        const unsub = rounded.on("change", setDisplay);
        const controls = animate(count, value, {
            duration,
            ease: [0.16, 1, 0.3, 1],
        });
        return () => {
            unsub();
            controls.stop();
        };
    }, [value, duration, count, rounded, reduced, decimals]);

    return (
        <span>
            {prefix}
            {display}
            {suffix}
        </span>
    );
}
