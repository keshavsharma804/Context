import type { Variants, Transition } from "motion/react";

export const spring = {
    gentle: { type: "spring", stiffness: 300, damping: 30 } as Transition,
    snappy: { type: "spring", stiffness: 500, damping: 35 } as Transition,
    bouncy: { type: "spring", stiffness: 400, damping: 20 } as Transition,
    soft: { type: "spring", stiffness: 150, damping: 20 } as Transition,
};

export const easeOut = [0.16, 1, 0.3, 1] as const;

export const staggerContainer: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

export const cardEnter: Variants = {
    hidden: { opacity: 0, y: 24, scale: 0.98 },
    show: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.5, ease: easeOut },
    },
};

export const itemEnter: Variants = {
    hidden: { opacity: 0, x: -12 },
    show: { opacity: 1, x: 0, transition: spring.gentle },
};

export const itemEnterRight: Variants = {
    hidden: { opacity: 0, x: 12 },
    show: { opacity: 1, x: 0, transition: spring.gentle },
};

export const pageTransition: Variants = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export const modalEnter: Variants = {
    hidden: { opacity: 0, scale: 0.94, y: 10 },
    show: { opacity: 1, scale: 1, y: 0, transition: spring.snappy },
    exit: { opacity: 0, scale: 0.94, y: 10, transition: { duration: 0.15 } },
};

/** Slower stagger for lists that need to feel like a cascade. */
export const listStagger: Variants = {
    hidden: {},
    show: {
        transition: { staggerChildren: 0.08, delayChildren: 0.12 },
    },
};

/** Backdrop for modals/popovers. */
export const backdropEnter: Variants = {
    hidden: { opacity: 0, backdropFilter: "blur(0px)" },
    show: { opacity: 1, backdropFilter: "blur(8px)", transition: { duration: 0.2 } },
    exit: { opacity: 0, backdropFilter: "blur(0px)", transition: { duration: 0.15 } },
};