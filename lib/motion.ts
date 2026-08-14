import type { Variants } from "framer-motion";

export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

/** Tactile hover feedback for interactive cards/buttons -- spread as a whileHover prop. */
export const hoverLift = { y: -3, scale: 1.005, transition: { duration: 0.15, ease: "easeOut" } } as const;

/** Tactile hover feedback for compact list rows -- a horizontal nudge instead of a lift. */
export const hoverShift = { scale: 1.01, x: 2, transition: { duration: 0.15, ease: "easeOut" } } as const;
