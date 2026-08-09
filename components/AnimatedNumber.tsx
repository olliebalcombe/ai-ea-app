"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

/** Spring count-up for a real numeric value — never used on fabricated numbers. */
export default function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 90, damping: 20 });
  const rounded = useTransform(spring, (v) => (format ? format(Math.round(v)) : Math.round(v).toLocaleString()));
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    return rounded.on("change", (v) => {
      if (ref.current) ref.current.textContent = v;
    });
  }, [rounded]);

  return (
    <motion.span ref={ref} className={className}>
      {format ? format(0) : "0"}
    </motion.span>
  );
}
