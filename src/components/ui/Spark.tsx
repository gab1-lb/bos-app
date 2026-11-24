const ok = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);

/** Mini-courbe d'évolution (legacy `spark`). */
export function Spark({ values }: { values: (number | null)[] }) {
  const v = values.filter(ok);
  if (v.length < 2) return null;
  const lo = Math.min(...v), hi = Math.max(...v), sp = hi - lo || 1, n = values.length;
  const pts = values
    .map((x, i) => (ok(x) ? [(i / (n - 1)) * 100, 36 - ((x - lo) / sp) * 30] : null))
    .filter((p): p is number[] => p !== null);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return (
    <svg className="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L100 40 L0 40Z`} fill="#e8eefc" />
      <path d={line} fill="none" stroke="#577ce5" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
