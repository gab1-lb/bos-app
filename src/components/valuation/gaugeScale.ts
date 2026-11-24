/** Shared horizontal scale for the valuation gauges (same "round" steps as legacy footballField). */
export type GaugeRange = { lo: number; mid: number; hi: number };
export type GaugeScale = { min: number; max: number; ticks: number[]; x(v: number): number };

const fin = (v: number) => Number.isFinite(v);

export function niceStep(x: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(x || 1)));
  const r = x / p;
  return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * p;
}

const clean = (v: number) => Number(v.toFixed(10));

export function gaugeScale(rows: GaugeRange[], marks: number[]): GaugeScale {
  if (!rows.length) return { min: 0, max: 1, ticks: [], x: () => 0 };
  const vals = rows.flatMap((r) => [r.lo, r.hi]).concat(marks).filter(fin);
  if (!vals.length) return { min: 0, max: 1, ticks: [], x: () => 0 };
  const lo0 = Math.min(...vals), hi0 = Math.max(...vals);
  const step = niceStep((hi0 - lo0) / 5);
  const min = clean(Math.max(0, Math.floor((lo0 * 0.94) / step) * step));
  let max = clean(Math.ceil((hi0 * 1.03) / step) * step);
  if (max <= min) max = clean(min + step);
  const ticks: number[] = [];
  for (let i = 0; ; i++) {
    const v = clean(min + i * step);
    if (v > max + 1e-9) break;
    ticks.push(v);
  }
  const span = max - min;
  return { min, max, ticks, x: (v: number) => (100 * (v - min)) / span };
}
