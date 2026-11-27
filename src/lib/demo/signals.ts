import { isDemo } from '../mode';

/* Demo only: things the visitor did that leave no trace in the deals (a tab seen, a message opened, a field edited),
   and the checklist steps already ticked (a tick never goes away, even if the deal moves on).
   Module state, in memory only: a reload starts the checklist over, like the demo data. */
export type DemoSignal = 'synthese' | 'msg:committee_note' | 'msg:director' | 'edit' | 'feedback';

let signals: ReadonlySet<DemoSignal> = new Set();
let latched: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Records a signal (no-op outside the demo). */
export function markDemo(s: DemoSignal): void {
  if (!isDemo() || signals.has(s)) return;
  signals = new Set([...signals, s]); // new snapshot, so useSyncExternalStore re-renders
  emit();
}

/** Current signals (a stable snapshot between changes). */
export const demoSignals = (): ReadonlySet<DemoSignal> => signals;

/** Keeps these checklist step ids done for the rest of the page life (no-op outside the demo). */
export function latchDone(ids: readonly string[]): void {
  const fresh = ids.filter((id) => !latched.has(id));
  if (!isDemo() || fresh.length === 0) return;
  latched = new Set([...latched, ...fresh]);
  emit();
}

/** Checklist step ids latched as done (a stable snapshot between changes). */
export const latchedDone = (): ReadonlySet<string> => latched;

export function subscribeDemoSignals(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Tests only: back to an untouched demo. */
export function __resetDemoSignals(): void {
  signals = new Set();
  latched = new Set();
}
