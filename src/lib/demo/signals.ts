import { isDemo } from '../mode';

/* Demo only: things the visitor did that leave no trace in the deals (a tab seen, a message opened, a field edited).
   Module state, in memory only: a reload starts the checklist over, like the demo data. */
export type DemoSignal = 'synthese' | 'msg:committee_note' | 'msg:director' | 'edit' | 'feedback';

let signals: ReadonlySet<DemoSignal> = new Set();
const listeners = new Set<() => void>();

/** Records a signal (no-op outside the demo). */
export function markDemo(s: DemoSignal): void {
  if (!isDemo() || signals.has(s)) return;
  signals = new Set([...signals, s]); // new snapshot, so useSyncExternalStore re-renders
  listeners.forEach((l) => l());
}

/** Current signals (a stable snapshot between changes). */
export const demoSignals = (): ReadonlySet<DemoSignal> => signals;

export function subscribeDemoSignals(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
