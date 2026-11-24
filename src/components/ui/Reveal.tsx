import type { CSSProperties, ReactNode } from 'react';

/** Fondu + montée de 8 px, décalé de index × 60 ms ; désactivé par prefers-reduced-motion (CSS). */
export function Reveal({ index = 0, className = '', style, children, as: Tag = 'div' }: {
  index?: number; className?: string; style?: CSSProperties; children: ReactNode; as?: 'div' | 'section';
}) {
  return (
    <Tag className={`reveal ${className}`} style={{ animationDelay: `${index * 60}ms`, ...style }}>
      {children}
    </Tag>
  );
}
