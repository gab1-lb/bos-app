'use client';
import { useEffect, useRef, useState } from 'react';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ease = (p: number) => 1 - Math.pow(1 - p, 3);

/** Fait défiler un nombre jusqu'à sa valeur (700 ms) ; valeur finale directe si prefers-reduced-motion. */
export function CountUp({ value, format, duration = 700 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  const from = useRef(shown);
  useEffect(() => {
    if (!Number.isFinite(value) || prefersReducedMotion()) { setShown(value); from.current = value; return; }
    const start = performance.now(), a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const v = p >= 1 ? value : a + (value - a) * ease(p);
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(shown)}</>;
}
