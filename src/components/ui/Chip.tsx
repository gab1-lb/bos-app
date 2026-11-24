import type { ReactNode } from 'react';

export type Tone = '' | 'good' | 'amber' | 'orange' | 'bad' | 'plain';

export function Chip({ tone = '', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span className={`chip ${tone}`} title={title}>{children}</span>;
}
