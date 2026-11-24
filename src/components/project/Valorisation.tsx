'use client';
import { N, dcf } from '../../engine/finance';
import type { Comp } from '../../engine/types';
import { useI18n } from '../../lib/repo-context';
import { Card } from '../ui/Card';
import { Check, Field, NumInput, TextInput } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Reveal } from '../ui/Reveal';
import { Gauges } from '../valuation/Gauges';
import { gaugeLabels } from './compute';
import { useBind, useProject } from './ProjectContext';

export function Valorisation() {
  const { deal: d, c, patch, editable } = useProject();
  const bind = useBind();
  const f = useI18n();
  const { t, nf, pc, mx, meur, unitM } = f;
  const { b, cp, dc, mp, ret } = c;
  const UM = unitM();
  const w = N(d.dcf.wacc), g = N(d.dcf.g);
  const comps = d.comps || [];
  const setComps = (next: Comp[]) => patch(['comps'], next);
  const points: [string, number | null | undefined][] = [
    [t('Prix demandé'), b.ask],
    [t('Médiane des transactions'), cp.evEbitda.med != null && b.adjEbitda != null ? cp.evEbitda.med * b.adjEbitda : null],
    [t('DCF central'), dc?.ev],
    [t('Prix max au TRI cible'), mp],
  ];
  const gRows = c.rows.map((r) => ({ ...r, ...gaugeLabels(r, c, d, f) }));
  const n = (v: number | null | undefined, dd = 1) => (v == null || !Number.isFinite(v) ? '—' : nf(v, dd));

  const dcfField = (label: string, key: 'wacc' | 'g') => {
    const bd = bind(['dcf', key], label);
    return <Field label={label} htmlFor={bd.id} unit="%"><NumInput {...bd} value={d.dcf[key]} /></Field>;
  };

  return (
    <>
      <Reveal index={0}>
        <Card title={t('Jauges de valorisation')} icon="scale" sub={t('valeur d’entreprise, {0}', UM)}>
          <Gauges values rows={gRows} marks={{ ask: b.ask, entry: ret ? ret.ev : null }}
            emptyText={t('Renseignez le CA, l’EBITDA et au moins un comparable pour afficher les fourchettes.')} />
        </Card>
      </Reveal>

      <Reveal index={1}>
        <Card className="mt" title={t('Transactions comparables')} icon="list"
          right={editable ? <button type="button" className="btn sm" onClick={() => setComps([...comps, { target: '', buyer: '', year: new Date().getFullYear(), geo: '', niche: '', rev: null, ebitda: null, ev: null, include: true }])}><Icon name="plus" />{t('Ajouter')}</button> : null}>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th /><th>{t('Cible')}</th><th>{t('Acquéreur')}</th><th className="n">{t('Année')}</th><th>{t('Zone')}</th><th>{t('Niche')}</th>
                  <th className="n">{t('CA')}</th><th className="n">EBITDA</th><th className="n">{t('VE')}</th><th className="n">{t('VE / CA')}</th><th className="n">{t('VE / EBITDA')}</th><th />
                </tr>
              </thead>
              <tbody>
                {cp.rows.map((r, i) => (
                  <tr key={i} className={r.include ? '' : 'off'}>
                    <td><Check {...bind(['comps', i, 'include'], t('Retenir'))} checked={r.include} /></td>
                    <td><TextInput {...bind(['comps', i, 'target'], t('Cible'))} value={r.target} /></td>
                    <td><TextInput {...bind(['comps', i, 'buyer'], t('Acquéreur'))} value={r.buyer} /></td>
                    <td className="n"><NumInput {...bind(['comps', i, 'year'], t('Année'))} value={r.year} raw className="w-s" /></td>
                    <td><TextInput {...bind(['comps', i, 'geo'], t('Zone'))} value={r.geo} /></td>
                    <td><TextInput {...bind(['comps', i, 'niche'], t('Niche'))} value={r.niche} /></td>
                    <td className="n"><NumInput {...bind(['comps', i, 'rev'], t('CA'))} value={r.rev} className="w-s" /></td>
                    <td className="n"><NumInput {...bind(['comps', i, 'ebitda'], 'EBITDA')} value={r.ebitda} className="w-s" /></td>
                    <td className="n"><NumInput {...bind(['comps', i, 'ev'], t('VE'))} value={r.ev} className="w-s" /></td>
                    <td className="n">{r.evRev == null ? '—' : mx(r.evRev)}</td>
                    <td className="n">{r.evEbitda == null ? '—' : mx(r.evEbitda)}</td>
                    <td>{editable && <button type="button" className="iconbtn" aria-label={t('Supprimer')} onClick={() => setComps(comps.filter((_, j) => j !== i))}><Icon name="x" /></button>}</td>
                  </tr>
                ))}
                {([['1er quartile', 'q1'], ['Médiane', 'med'], ['3e quartile', 'q3']] as const).map(([l, k]) => (
                  <tr key={k} className={k === 'med' ? 'tot' : 'sub'}>
                    <td /><td colSpan={8}>{t(l)}</td>
                    <td className="n">{cp.evRev[k] == null ? '—' : mx(cp.evRev[k]!)}</td>
                    <td className="n">{cp.evEbitda[k] == null ? '—' : mx(cp.evEbitda[k]!)}</td><td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note" style={{ marginTop: 12 }}>
            {d.example ? <><b>{t('Transactions illustratives.')}</b> {t('Remplacez-les par vos sources (Mergermarket, Capital IQ, communiqués).')} </> : null}
            {t('Décochez une opération pour l’exclure des quartiles. Montants en {0}.', UM)}
          </p>
        </Card>
      </Reveal>

      <Reveal className="g2b mt" index={2}>
        <Card title="DCF" icon="trend">
          <div className="form" style={{ gridTemplateColumns: 'repeat(2,minmax(0,200px))' }}>
            {dcfField('WACC', 'wacc')}
            {dcfField(t('Croissance à l’infini'), 'g')}
          </div>
          {dc ? (
            <>
              <div className="tw" style={{ marginTop: 16 }}>
                <table>
                  <thead><tr><th>{UM}</th>{dc.rows.map((r) => <th className="n" key={r.year}>{r.year}P</th>)}</tr></thead>
                  <tbody>
                    {([[t('Chiffre d’affaires'), 'rev', 1], ['EBITDA', 'ebitda', 1], [t('IS normatif'), 'taxes', -1], ['Capex', 'capex', -1], [t('Variation de BFR'), 'dNwc', -1]] as const).map(([l, k, s]) => (
                      <tr key={k}><td className="lbl">{l}</td>{dc.rows.map((r) => <td className="n" key={r.year}>{nf(s * r[k], 2)}</td>)}</tr>
                    ))}
                    <tr className="tot"><td>{t('Flux de trésorerie disponible')}</td>{dc.rows.map((r) => <td className="n" key={r.year}>{nf(r.fcf, 2)}</td>)}</tr>
                    <tr className="sub"><td>{t('Valeur actualisée')}</td>{dc.rows.map((r) => <td className="n" key={r.year}>{nf(r.pv, 2)}</td>)}</tr>
                  </tbody>
                </table>
              </div>
              <div className="stats" style={{ marginTop: 16 }}>
                {([[t('VE · DCF'), meur(dc.ev), true], [t('Valeur terminale actualisée'), meur(dc.pvTv), false], [t('Poids de la valeur terminale'), pc(dc.tvShare * 100, 0), false], [t('Multiple de sortie implicite'), mx(dc.impliedExit), false]] as const).map(([l, v, hl]) => (
                  <div key={l} className={`stat ${hl ? 'hl' : ''}`}><small>{l}</small><strong>{v}</strong></div>
                ))}
              </div>
              <p className="note" style={{ marginTop: 12 }}>{t('Convention de mi-année. Hypothèses de plan dans l’onglet Données financières.')}</p>
            </>
          ) : <div className="empty">{t('Renseignez le CA, l’EBITDA et un WACC supérieur à la croissance à l’infini.')}</div>}
        </Card>
        <div className="stack">
          {dc && w != null && g != null && (
            <Card title={t('Sensibilité du DCF')} icon="grid" sub={UM}>
              <div className="tw">
                <table>
                  <thead><tr><th>WACC \ g</th>{[g - 1, g - 0.5, g, g + 0.5, g + 1].map((x) => <th className="n" key={x}>{pc(x)}</th>)}</tr></thead>
                  <tbody>
                    {[w - 2, w - 1, w, w + 1, w + 2].map((a) => (
                      <tr key={a}>
                        <td className="lbl">{pc(a)}</td>
                        {[g - 1, g - 0.5, g, g + 0.5, g + 1].map((z) => <td key={z} className={`n ${a === w && z === g ? 'hl' : ''}`}>{n(dcf(d, a, z)?.ev)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          <Card title={t('De la VE à la valeur des titres')} icon="coins">
            <div className="tw">
              <table>
                <thead><tr><th>{UM}</th><th className="n">{t('VE')}</th><th className="n">{t('Dette nette')}</th><th className="n">{t('Assimilés')}</th><th className="n">{t('Titres')}</th></tr></thead>
                <tbody>
                  {points.map(([l, v]) => (
                    <tr key={l}>
                      <td className="lbl">{l}</td><td className="n">{n(v)}</td>
                      <td className="n">{b.netDebt == null ? '?' : nf(-b.netDebt)}</td>
                      <td className="n">{nf(-(b.debtLike || 0))}</td>
                      <td className="n" style={{ fontWeight: 650 }}>{v == null || b.netDebt == null ? '—' : nf(v - b.netDebt - (b.debtLike || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note" style={{ marginTop: 12 }}>{t('Avant BFR normatif et mécanisme de prix (locked box ou comptes de clôture).')}</p>
          </Card>
        </div>
      </Reveal>
    </>
  );
}
