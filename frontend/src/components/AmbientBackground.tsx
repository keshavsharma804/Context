import { useEffect, useState, useMemo } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "../hooks/useReducedMotion";

type TimePhase = "dawn" | "day" | "dusk" | "night";

function getTimePhase(): TimePhase {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 9) return "dawn";
    if (hour >= 9 && hour < 17) return "day";
    if (hour >= 17 && hour < 20) return "dusk";
    return "night";
}

const PHASE_PALETTES: Record<
    TimePhase,
    {
        name: string;
        orb1Tint: string;
        orb2Tint: string;
        auroraRibbon: string;
        particleOpacity: number;
    }
> = {
    dawn: {
        name: "Morning Aurora",
        orb1Tint: "rgba(251, 146, 60, 0.16)", // Warm sunrise peach
        orb2Tint: "rgba(167, 139, 250, 0.14)", // Soft dawn lavender
        auroraRibbon: "linear-gradient(90deg, transparent, rgba(251, 146, 60, 0.12), rgba(244, 114, 182, 0.1), transparent)",
        particleOpacity: 0.35,
    },
    day: {
        name: "Daylight Sky",
        orb1Tint: "hsl(var(--primary) / 0.18)", // Theme primary
        orb2Tint: "hsl(var(--theme-accent) / 0.14)", // Theme accent
        auroraRibbon: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.1), hsl(var(--theme-accent) / 0.08), transparent)",
        particleOpacity: 0.3,
    },
    dusk: {
        name: "Golden Hour Glow",
        orb1Tint: "rgba(245, 158, 11, 0.18)", // Warm amber
        orb2Tint: "rgba(217, 70, 239, 0.14)", // Dusk magenta
        auroraRibbon: "linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.14), rgba(168, 85, 247, 0.12), transparent)",
        particleOpacity: 0.4,
    },
    night: {
        name: "Midnight Borealis",
        orb1Tint: "rgba(99, 102, 241, 0.16)", // Midnight indigo
        orb2Tint: "rgba(14, 165, 233, 0.13)", // Deep cyan aurora
        auroraRibbon: "linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.1), rgba(14, 165, 233, 0.1), transparent)",
        particleOpacity: 0.45,
    },
};

const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 9,
    duration: 18 + Math.random() * 14,
    size: 1 + Math.random() * 2.2,
    drift: Math.random() * 30 - 15,
}));

export function AmbientBackground() {
    const reduced = useReducedMotion();
    const [phase, setPhase] = useState<TimePhase>(getTimePhase);

    // Periodically update time phase (e.g. every 5 minutes)
    useEffect(() => {
        const interval = setInterval(() => {
            const next = getTimePhase();
            setPhase((prev) => (prev !== next ? next : prev));
        }, 300000);
        return () => clearInterval(interval);
    }, []);

    const palette = useMemo(() => PHASE_PALETTES[phase], [phase]);

    return (
        <div
            aria-hidden
            data-ambient-background
            className="pointer-events-none fixed inset-0 -z-10 overflow-hidden [contain:strict] transition-colors duration-1000"
        >
            {/* Base background fill */}
            <div className="absolute inset-0 bg-background" />

            {/* Dynamic Aurora Wave Ribbon at the top */}
            {!reduced && (
                <motion.div
                    className="absolute -top-24 inset-x-0 h-64 blur-3xl opacity-80 will-change-transform"
                    style={{ background: palette.auroraRibbon }}
                    animate={{
                        x: [-60, 60, -60],
                        scaleY: [1, 1.25, 0.9, 1],
                    }}
                    transition={{
                        duration: 22,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            )}

            {/* Drifting Primary Orb */}
            {!reduced && (
                <>
                    <motion.div
                        className="absolute h-[620px] w-[620px] rounded-full blur-[130px] will-change-transform transition-colors duration-1000"
                        style={{
                            background: `radial-gradient(circle, ${palette.orb1Tint} 0%, transparent 70%)`,
                            top: "-15%",
                            left: "5%",
                        }}
                        animate={{
                            x: [0, 80, -40, 0],
                            y: [0, 40, 80, 0],
                            scale: [1, 1.08, 0.98, 1],
                        }}
                        transition={{
                            duration: 28,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />
                    {/* Drifting Secondary Orb */}
                    <motion.div
                        className="absolute h-[540px] w-[540px] rounded-full blur-[110px] will-change-transform transition-colors duration-1000"
                        style={{
                            background: `radial-gradient(circle, ${palette.orb2Tint} 0%, transparent 70%)`,
                            bottom: "-15%",
                            right: "5%",
                        }}
                        animate={{
                            x: [0, -60, 40, 0],
                            y: [0, -40, 30, 0],
                            scale: [1, 0.96, 1.06, 1],
                        }}
                        transition={{
                            duration: 32,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />
                </>
            )}

            {/* Floating Celestial Stardust Particles */}
            {!reduced && (
                <div className="absolute inset-0">
                    {PARTICLES.map((p) => (
                        <motion.div
                            key={p.id}
                            className="absolute rounded-full bg-primary will-change-transform"
                            style={{
                                left: `${p.x}%`,
                                bottom: "-10px",
                                width: p.size,
                                height: p.size,
                                opacity: palette.particleOpacity,
                            }}
                            animate={{
                                y: ["0vh", "-112vh"],
                                x: [0, p.drift, 0],
                            }}
                            transition={{
                                y: {
                                    duration: p.duration,
                                    delay: p.delay,
                                    repeat: Infinity,
                                    ease: "linear",
                                },
                                x: {
                                    duration: p.duration / 2,
                                    delay: p.delay,
                                    repeat: Infinity,
                                    repeatType: "reverse",
                                    ease: "easeInOut",
                                },
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Subtle Grid Matrix Overlay */}
            <div
                className="absolute inset-0 opacity-[0.025]"
                style={{
                    backgroundImage:
                        "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
                    backgroundSize: "48px 48px",
                }}
            />
        </div>
    );
}
