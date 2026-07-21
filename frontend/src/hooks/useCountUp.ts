"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 (or its previous value) up to `target` over
 * `durationMs`, using an ease-out curve. Pass durationMs=0 to skip
 * animation and return the target immediately.
 */
export function useCountUp(target: number, durationMs: number): number {
  const [value, setValue] = useState(durationMs > 0 ? 0 : target);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (durationMs <= 0) {
      setValue(target);
      return;
    }

    startRef.current = null;
    let raf = 0;

    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}
