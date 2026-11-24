'use client';
import { returns, sum } from '../../engine/finance';
import type { Returns, ReturnsRow } from '../../engine/types';
import { useI18n } from '../../lib/repo-context';
import { Card } from '../ui/Card';
import { Check, Field, NumInput, TextInput } from '../ui/Field';
import { CountUp } from '../ui/CountUp';
import { Metric } from '../ui/Metric';
import { Reveal } from '../ui/Reveal';
import { useBind, useProject } from './ProjectContext';

const ok = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);

export function Rendement() {
  const { deal: d, c } = useProject();
  const bind = useBind();
  const { t, nf, pc, mx, sg, meur, unitM } = useI18n();
  const { b, ret, mp } = c;
  const f = d.financing, s = d.synergies, UM = unitM();

  const fld = (label: string, path: string[], value: number | null, unit: string, o: { d?: number; ph?: string } = {}) => {
    const bd = bind(path, label);
    return <Field label={label} htmlFor={bd.id} unit={unit}><NumInput {...bd} value={value} decimals={o.d ?? 1} placeholder={o.ph || '—'} /></Field>;
  };

  const hyp = (
    <Card title={t('Hypothèses de l’opération')} icon="settings">
      <div className="form">
        {fld(t('VE d’entrée'), ['financing', 'entryEv'], f.entryEv, UM, { ph: ok(b.ask) ? `${nf(b.ask)} · ${t('demandé')}` : '' })}
        {fld(t('Frais d’acquisition'), ['financing', 'feesPct'], f.feesPct, t('% VE'))}
        {fld(t('Dette d’acquisition'), ['financing', 'leverage'], f.leverage, t('× EBITDA'))}
        {fld(t('Taux d’intérêt'), ['financing', 'rate'], f.rate, '%')}
        {fld(t('Amortissement de la dette'), ['financing', 'amortYears'], f.amortYears, t('ans'), { d: 0 })}
        {fld(t('Horizon d’analyse'), ['financing', 'hold'], f.hold, t('ans'), { d: 0 })}
        {fld(t('Multiple de sortie'), ['financing', 'exitMultiple'], f.exitMultiple, t('× EBITDA'), { ph: ret ? `${nf(ret.entryMult)} · ${t('entrée')}` : '' })}
        <div className="field">
          <span style={{ fontSize: 13, color: '#566378', fontWeight: 500 }}>{t('Remboursement anticipé')}</span>
          <Check {...bind(['financing', 'sweep'], t('Affecter la trésorerie à la dette'))} checked={f.sweep}>{t('Affecter la trésorerie à la dette')}</Check>
        </div>
      </div>
    </Card>
  );
  const noteB = bind(['synergies', 'note'], t('Origine des synergies'));
  const syn = (
    <Card title={t('Synergies d’intégration')} icon="layers">
      <div className="form">
        {fld(t('Synergies de coûts'), ['synergies', 'cost'], s.cost, t('{0} / an', UM), { d: 2 })}
        {fld(t('Synergies de revenus (EBITDA)'), ['synergies', 'revenue'], s.revenue, t('{0} / an', UM), { d: 2 })}
        {fld(t('Montée en charge'), ['synergies', 'rampYears'], s.rampYears, t('ans'), { d: 0 })}
        {fld(t('Coûts d’intégration (an 1)'), ['synergies', 'integrationCost'], s.integrationCost, UM, { d: 2 })}
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor={noteB.id}>{t('Origine des synergies')}</label>
        <TextInput {...noteB} value={s.note} />
      </div>
    </Card>
  );

  if (!ret) {
    return (
      <>
        <Reveal className="g2e" index={0}>{hyp}{syn}</Reveal>
        <Reveal index={1}><div className="card panel mt"><div className="empty">{t('Il manque l’EBITDA retenu ou un prix d’entrée.')}</div></div></Reveal>
      </>
    );
  }

  const adjE = b.adjEbitda as number;
  const exitShare = ret.exitEq / sum(ret.flows.slice(1));
  const em = ret.entryMult;
  const entryM = [-2, -1, 0, 1, 2].map((x) => em + x), exitM = [-2, -1, 0, 1, 2].map((x) => ret.exitMult + x);
  const cell = (r: Returns | null, key: string) => {
    if (!r || r.irr == null) return <td className="n" key={key}>—</td>;
    const v = r.irr * 100;
    return <td key={key} className={`n ${v >= c.hurdle ? 'hg' : 'hb'}`}>{pc(v)}</td>;
  };
  const irr = ret.irr == null ? null : ret.irr * 100;
  const R = ret.rows;
  const line = (l: string, k: keyof ReturnsRow, sgn = 1, dec = 2, cls = '') => (
    <tr className={cls} key={String(k) + l}>
      <td className="lbl">{l}</td>
      {R.map((r) => {
        const v = r[k] as number | null;
        const z = !ok(v) || Math.abs(v) < 0.005;
        return <td key={r.year} className={`n ${z ? 'dim' : ''}`}>{z ? '–' : nf(sgn * (v as number), dec)}</td>;
      })}
    </tr>
  );

  return (
    <>
      <Reveal className="g4" index={0}>
        <Metric label={t('TRI')} icon="trend" naLabel={t('À calculer')} value={irr == null ? null : <CountUp value={irr} format={(v) => pc(v)} />}
          foot={irr == null ? null : <><span className={irr >= c.hurdle ? 'up' : 'down'}>{irr >= c.hurdle ? t('au-dessus du seuil') : t('sous le seuil')}</span> {t('de {0}', pc(c.hurdle, 0))}</>} />
        <Metric label={t('Multiple du capital')} icon="coins" naLabel={t('À calculer')} value={<CountUp value={ret.mom} format={(v) => mx(v, 2)} />} foot={t('sur {0} ans', ret.H)} />
        <Metric label={t('Prix max au TRI cible')} icon="target" naLabel={t('À calculer')} value={mp == null ? null : <CountUp value={mp} format={(v) => meur(v)} />}
          foot={ok(b.ask) && mp ? <><span className={mp >= b.ask ? 'up' : 'down'}>{sg(100 * (mp / b.ask - 1), 0)}</span> {t('vs prix demandé')}</> : null} />
        <Metric label={t('ROIC année 5')} icon="percent" naLabel={t('À calculer')} value={<CountUp value={ret.roic5 * 100} format={(v) => pc(v)} />} foot={t('résultat d’exploitation après IS / capital investi')} />
      </Reveal>
      <Reveal className="stats mt" index={1}>
        {([
          [t('Rendement cash an 1'), pc(ret.cashYield1 * 100), t('flux avant dette / emplois')],
          [t('Retour sur fonds propres'), ret.payback ? t('{0} ans', ret.payback) : t('> {0} ans', ret.H), t('hors valeur de sortie')],
          [t('Levier maximal'), mx(ret.maxLev), t('dette / EBITDA')],
          [t('Part de la sortie dans les flux'), pc(exitShare * 100, 0), t('dépendance à la revente')],
        ] as const).map(([l, v, s2]) => <div className="stat" key={l}><small>{l}</small><strong>{v}</strong><span>{s2}</span></div>)}
      </Reveal>
      <p className="note" style={{ margin: '12px 2px 0' }}>{t('Pour un acquéreur qui conserve ses participations, regardez d’abord le ROIC, le rendement cash et le prix maximal. Plus la part de la sortie est élevée, plus le TRI dépend de la revente.')}</p>

      <Reveal className="g2e mt" index={2}>
        {hyp}
        <div className="stack">
          {syn}
          <Card title={t('Emplois et ressources')} icon="scale">
            <div className="tw">
              <table>
                <thead><tr><th>{t('Emplois')}</th><th className="n">{UM}</th><th>{t('Ressources')}</th><th className="n">{UM}</th></tr></thead>
                <tbody>
                  <tr><td className="lbl">{t('Titres')}</td><td className="n">{nf(ret.ev - (b.netDebt || 0))}</td><td className="lbl">{t('Dette d’acquisition')}</td><td className="n">{nf(ret.debt0)}</td></tr>
                  <tr><td className="lbl">{t('Refinancement de la dette nette')}</td><td className="n">{nf(b.netDebt || 0)}</td><td className="lbl">{t('Fonds propres')}</td><td className="n">{nf(ret.equity)}</td></tr>
                  <tr><td className="lbl">{t('Éléments assimilés')}</td><td className="n">{nf(ret.debtLike)}</td><td /><td /></tr>
                  <tr><td className="lbl">{t('Frais')}</td><td className="n">{nf(ret.fees)}</td><td /><td /></tr>
                  <tr className="tot"><td>{t('Total')}</td><td className="n">{nf(ret.uses)}</td><td>{t('Total')}</td><td className="n">{nf(ret.debt0 + ret.equity)}</td></tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </Reveal>

      <Reveal index={3}>
        <Card className="mt" title={t('Flux annuels')} icon="chart">
          <div className="tw">
            <table>
              <thead><tr><th>{UM}</th>{R.map((r) => <th className="n" key={r.year}>{r.year}</th>)}</tr></thead>
              <tbody>
                {line(t('Chiffre d’affaires'), 'rev', 1, 1)}
                {line(t('EBITDA autonome'), 'ebitda')}
                {line(t('Synergies réalisées'), 'syn')}
                {line(t('EBITDA total'), 'ebitdaTot', 1, 2, 'tot')}
                {line(t('Coûts d’intégration'), 'integ', -1)}
                {line(t('IS'), 'taxes', -1)}
                {line('Capex', 'capex', -1)}
                {line(t('Variation de BFR'), 'dNwc', -1)}
                {line(t('Flux avant service de la dette'), 'fcfPre', 1, 2, 'tot')}
                {line(t('Intérêts'), 'interest', -1)}
                {line(t('Remboursement de la dette'), 'amort', -1)}
                {line(t('Remboursement anticipé'), 'sweep', -1)}
                {line(t('Flux disponible pour l’acquéreur'), 'fcfe', 1, 2, 'tot')}
                {line(t('Dette en fin d’année'), 'debtEnd')}
                <tr className="sub"><td>{t('Dette / EBITDA')}</td>{R.map((r) => <td className="n" key={r.year}>{r.lev == null ? '—' : mx(r.lev)}</td>)}</tr>
                <tr className="sub"><td>ROIC</td>{R.map((r) => <td className="n" key={r.year}>{pc(r.roic * 100)}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <p className="note" style={{ marginTop: 12 }}>{t('Sortie en année {0} : VE de {1} moins la dette restante, soit {2} pour les titres.', ret.H, meur(ret.exitEv), meur(ret.exitEq))}</p>
        </Card>
      </Reveal>

      <Reveal className="g2e mt" index={4}>
        <Card title={t('TRI selon les multiples')} icon="grid" sub={t('entrée × sortie')}>
          <div className="tw">
            <table>
              <thead><tr><th>{t('Entrée \\ sortie')}</th>{exitM.map((x) => <th className="n" key={x}>{mx(x)}</th>)}</tr></thead>
              <tbody>
                {entryM.map((a) => (
                  <tr key={a}><td className="lbl">{mx(a)} · {meur(a * adjE)}</td>{exitM.map((z) => cell(returns(d, { ev: a * adjE, exitMult: z }), String(z)))}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note" style={{ marginTop: 12 }}>{t('Vert : TRI au moins égal au seuil de {0}. Multiples appliqués à l’EBITDA retenu ({1}).', pc(c.hurdle, 0), meur(adjE, 2))}</p>
        </Card>
        <Card title={t('TRI selon l’exécution')} icon="grid" sub={t('croissance × synergies')}>
          <div className="tw">
            <table>
              <thead><tr><th>{t('Croissance \\ synergies')}</th>{[0, 0.5, 1, 1.5].map((x) => <th className="n" key={x}>{pc(x * 100, 0)}</th>)}</tr></thead>
              <tbody>
                {[-6, -3, 0, 3].map((a) => (
                  <tr key={a}><td className="lbl">{t('{0} / an', sg(a, 0, ' pt'))}</td>{[0, 0.5, 1, 1.5].map((z) => cell(returns(d, { growthShift: a, synergyMult: z }), String(z)))}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note" style={{ marginTop: 12 }}>{t('Écart de croissance annuelle par rapport au plan, et part des synergies réalisée.')}</p>
        </Card>
      </Reveal>
    </>
  );
}
