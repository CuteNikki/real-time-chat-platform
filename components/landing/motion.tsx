'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties, ReactNode } from 'react';

// House easing for the whole landing page — a soft, high-end "settle" curve
// (fast out, gentle in). Used by every physics-y transition so motion feels
// like one coherent system rather than a pile of unrelated fades.
export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Reveal-on-scroll wrapper. Animates its children up + in the first time they
// enter the viewport, then leaves them alone. Fully inert under
// prefers-reduced-motion (renders final state immediately, no transform).
export function Reveal({
  children,
  className,
  style,
  delay = 0,
  y = 24,
  once = true,
  amount = 0.3,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  delay?: number;
  y?: number;
  once?: boolean;
  amount?: number;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}
