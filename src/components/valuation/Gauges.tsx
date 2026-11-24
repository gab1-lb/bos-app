'use client';
import type { CSSProperties } from 'react';
import { useI18n } from '../../lib/repo-context';
import { gaugeScale } from './gaugeScale';

export { gaugeScale } from './gaugeScale';

export type GaugeRow = { label: string; sub?: string; lo: number; mid: number; hi: number };

const ok = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);
const clamp = (v: number) => Math.max(0, Math.min(100, v));

/**
 * Jauges de valorisation : une piste arrondie par méthode, segment bas–haut en dégradé bleu
 * qui se remplit (700 ms), point central, repères communs « Demandé » / « Entrée », axe partagé.
 */
export function Gauges({ rows, marks, values = false, compact = false, emptyText }: {
  rows: GaugeRow[]; marks: { ask: number | null; entry: number | null }; values?: boolean; compact?: boolean; emptyText: string;
}) {
  const { t, nf, meur, unitM } = useI18n();
  if (!rows.length) return <div className="empty">{emptyText}</div>;
  const { ask, entry } = marks;
  const showEntry = ok(entry) && Math.abs(entry - (ask ?? -1)) > 0.05;
  const s = gaugeScale(rows, [ask, showEntry ? entry : null].filter(ok));
  const X = (v: number) => clamp(s.x(v));
  const n = rows.length;
  const over: CSSProperties = { gridColumn: 2, gridRow: `1 / span ${n + 1}` };

  return (
    <>
      <div className={`gz ${compact ? 'compact' : ''} ${showEntry ? 'has-entry' : ''}`}>
        <span className="gz-lane" style={{ gridColumn: 1, gridRow: 1 }} />
        <span className="gz-lane" style={{ gridColumn: 2, gridRow: 1 }} />
        {rows.map((r, i) => {
          const l = X(r.lo), w = Math.max(0.8, X(r.hi) - l);
          const aria = `${r.label} : ${t('Bas')} ${meur(r.lo)}, ${t('Central')} ${meur(r.mid)}, ${t('Haut')} ${meur(r.hi)}`;
          return [
            <div key={`l${i}`} className="gz-lbl" style={{ gridColumn: 1, gridRow: i + 2 }}>
              {r.label}{r.sub && <small>{r.sub}</small>}
            </div>,
            <div key={`g${i}`} className="gz-row" style={{ gridColumn: 2, gridRow: i + 2 }} role="img" aria-label={aria} data-gauge="" title={aria}>
              <div className="gz-track">
                <div className="gz-seg grow" style={{ left: `${l}%`, width: `${w}%`, animationDelay: `${i * 60}ms` }} />
              </div>
              <span className="gz-dot" style={{ left: `${X(r.mid)}%`, animationDelay: `${i * 60 + 520}ms` }} />
              {values && (
                <>
                  <span className="gz-mid" style={{ left: `${X(r.mid)}%`, animationDelay: `${i * 60 + 520}ms` }}>{nf(r.mid)}</span>
                  <span className="gz-val lo" style={{ right: `${100 - l}%` }}>{nf(r.lo)}</span>
                  <span className="gz-val hi" style={{ left: `${l + w}%` }}>{nf(r.hi)}</span>
                </>
              )}
            </div>,
          ];
        })}
        <div className="gz-over" style={over} aria-hidden="true">
          {s.ticks.map((tk) => <i key={tk} className="gz-grid" style={{ left: `${X(tk)}%` }} />)}
          {ok(ask) && (
            <div className="gz-mark" style={{ left: `${X(ask)}%` }}>
              <span className="gz-tag">{t('Demandé')} {nf(ask)}</span>
            </div>
          )}
          {showEntry && (
            <div className="gz-mark entry" style={{ left: `${X(entry)}%` }}>
              <span className="gz-tag">{t('Entrée')} {nf(entry)}</span>
            </div>
          )}
        </div>
        <span style={{ gridColumn: 1, gridRow: n + 2 }} />
        <div className="gz-axis" style={{ gridColumn: 2, gridRow: n + 2 }} aria-hidden="true">
          {s.ticks.map((tk) => <span key={tk} style={{ left: `${X(tk)}%` }}>{nf(tk, 0)}</span>)}
        </div>
      </div>
      <div className="legend">
        <span><i className="seg" />{t('Fourchette de VE ({0})', unitM())}</span>
        <span><i className="dot" />{t('Valeur centrale')}</span>
        {ok(ask) && <span><i className="ask" />{t('Prix demandé')}</span>}
        {showEntry && <span><i className="entry" />{t('VE d’entrée retenue')}</span>}
      </div>
    </>
  );
}
