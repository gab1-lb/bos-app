'use client';
import { N, plan } from '../../engine/finance';
import type { Adjustment } from '../../engine/types';
import { useI18n } from '../../lib/repo-context';
import { Card } from '../ui/Card';
import { Check, Field, NumInput, Select, TextInput } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Reveal } from '../ui/Reveal';
import { niceStep } from '../valuation/gaugeScale';
import { newItemId } from '../../domain/dealShape';
import { useBind, useBindItem, useProject } from './ProjectContext';

const ok = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);
const ADJ_STATUS = ['Accepté', 'À confirmer', 'Rejeté'];

export function Financiers() {
  const { deal: d, c, patch, editable, appendItems, removeItem } = useProject();
  const bind = useBind();
  const bindA = useBindItem();
  const { t, nf, pc, sg, meur, unitM } = useI18n();
  const b = c.b, h = d.hist, yrs = h.years;
  const pl = plan(d, d.plan.growth.length) || [];
  const UM = unitM();

  const g = h.rev.map((v, i) => (i && ok(N(v)) && (h.rev[i - 1] ?? 0) > 0 ? 100 * ((v as number) / (h.rev[i - 1] as number) - 1) : null));
  const mg = h.rev.map((v, i) => (v != null && v > 0 && ok(N(h.ebitda[i])) ? (100 * (h.ebitda[i] as number)) / v : null));
  const series = yrs.map((y, i) => ({ y, r: N(h.rev[i]), e: N(h.ebitda[i]), fc: false }))
    .concat(pl.map((p) => ({ y: p.year, r: p.rev, e: p.ebitda, fc: true })));
  const top = Math.max(1, ...series.map((s) => s.r || 0)), st = niceStep(top / 4), ymax = Math.ceil(top / st) * st;

  const histRow = (lbl: string, key: 'rev' | 'ebitda' | 'capex', dec = 1) => (
    <tr>
      <td className="lbl">{lbl}</td>
      {h[key].map((v, i) => (
        <td className="n" key={i}><NumInput {...bind(['hist', key, i], `${lbl} ${yrs[i]}`)} value={v} decimals={dec} className="w-s" /></td>
      ))}
      {pl.map((p) => <td key={p.year} />)}
    </tr>
  );
  const calc = (lbl: string, hv: (number | null)[], pv: (number | null)[], f: (v: number | null) => string, cls = '') => (
    <tr className={cls}>
      <td className="lbl">{lbl}</td>
      {hv.map((v, i) => <td className="n" key={i}>{f(v)}</td>)}
      {pv.map((v, i) => <td className="n dim" key={`p${i}`}>{f(v)}</td>)}
    </tr>
  );
  const setYear = (i: number, v: number | null) => {
    if (v == null) return;
    patch(['hist', 'years'], yrs.map((_, j) => Math.round(v) - i + j));
  };

  const adj = d.adjustments || [];
  const newAdj = (): Adjustment => ({ id: newItemId(), label: t('Nouveau retraitement'), amount: 0, included: false, status: 'À confirmer' });
  const kfield = (label: string, path: string[], value: number | null, unit: string, o: { d?: number; ref?: string; ph?: string } = {}) => {
    const bd = bind(path, label);
    return (
      <Field label={label} htmlFor={bd.id} unit={unit} refText={o.ref}>
        <NumInput {...bd} value={value} decimals={o.d ?? 1} placeholder={o.ph} />
      </Field>
    );
  };

  return (
    <>
      <Reveal index={0}>
        <Card title={t('Compte de résultat')} icon="chart" sub={t('historique saisi · plan calculé')} right={<span className="hint"><i />{t('Valeur modifiable')}</span>}>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{UM}</th>
                  {yrs.map((y, i) => (
                    <th className="n" key={i}>
                      <NumInput id={`f-hist.years.${i}`} label={t('Année')} value={y} raw className="w-s" readOnly={!editable} onCommit={(v) => setYear(i, v)} />
                    </th>
                  ))}
                  {pl.map((p) => <th className="n" key={p.year}>{p.year}P</th>)}
                </tr>
              </thead>
              <tbody>
                {histRow(t('Chiffre d’affaires'), 'rev')}
                {calc(t('Croissance'), g, pl.map((p) => p.g), (v) => (v == null ? '—' : sg(v)), 'sub')}
                {histRow(t('EBITDA publié'), 'ebitda', 2)}
                {calc(t('Marge d’EBITDA'), mg, pl.map((p) => p.margin), (v) => (v == null ? '—' : pc(v)), 'sub')}
                {calc(t('EBITDA du plan (base retenue)'), h.ebitda.map(() => null), pl.map((p) => p.ebitda), (v) => (v == null ? '' : nf(v, 2)))}
                {histRow('Capex', 'capex', 2)}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 20 }}>
            <div className="cols">
              {[1, 2, 3, 4].map((i) => (i * st <= ymax ? <div key={i} className="gl" style={{ bottom: `${(100 * i * st) / ymax}%` }}><span>{nf(i * st, 0)}</span></div> : null))}
              {series.map((s, i) => (
                <div key={i} className={`colg ${s.fc ? 'fc' : ''}`}
                  title={`${s.y}${s.fc ? ' (' + t('plan') + ')' : ''}\n${t('CA')} ${s.r == null ? '—' : meur(s.r)}\nEBITDA ${s.e == null ? '—' : meur(s.e, 2)}`}>
                  <i className="r" style={{ height: `${(100 * (s.r || 0)) / ymax}%` }} />
                  <i className="e" style={{ height: `${(100 * Math.max(0, s.e || 0)) / ymax}%` }} />
                </div>
              ))}
            </div>
            <div className="colx">{series.map((s, i) => <span key={i}>{s.y}{s.fc ? 'P' : ''}</span>)}</div>
            <div className="legend">
              <span><i style={{ background: 'var(--spark)' }} />{t('Chiffre d’affaires')} ({UM})</span>
              <span><i style={{ background: 'var(--orange)' }} />EBITDA</span>
              <span><i style={{ background: 'var(--spark)', opacity: 0.42 }} />{t('Années de plan (P)')}</span>
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal className="g2b mt" index={1}>
        <Card title={t('Qualité des résultats')} icon="scale"
          right={editable ? <button type="button" className="btn sm" onClick={() => appendItems('adjustments', [newAdj()])}><Icon name="plus" />{t('Ajouter')}</button> : null}>
          <div className="tw">
            <table>
              <thead><tr><th>{t('Retraitement')}</th><th className="n">{UM}</th><th>{t('Inclus vendeur')}</th><th>{t('Statut')}</th><th /></tr></thead>
              <tbody>
                <tr className="tot"><td>{t('EBITDA publié')} {b.year || ''}</td><td className="n">{b.ebitda == null ? '—' : nf(b.ebitda, 2)}</td><td /><td /><td /></tr>
                {adj.map((a, i) => {
                  const f = (field: string, label: string) => bindA('adjustments', i, a.id, field, label);
                  return (
                    <tr key={a.id}>
                      <td><TextInput {...f('label', t('Libellé'))} value={a.label} className="w-xl" /></td>
                      <td className="n"><NumInput {...f('amount', t('Montant'))} value={a.amount} decimals={2} className="w-s" /></td>
                      <td><Check {...f('included', t('Inclus vendeur'))} checked={a.included} /></td>
                      <td><Select {...f('status', t('Statut'))} value={a.status} options={ADJ_STATUS.map((s) => [s, t(s)])} /></td>
                      <td>{editable && <button type="button" className="iconbtn" aria-label={t('Supprimer')} onClick={() => removeItem('adjustments', a.id)}><Icon name="x" /></button>}</td>
                    </tr>
                  );
                })}
                <tr className="tot"><td>{t('EBITDA retenu')}</td><td className="n">{b.adjEbitda == null ? '—' : nf(b.adjEbitda, 2)}</td><td colSpan={3} className="dim" style={{ fontWeight: 450 }}>{sg(b.adjNet, 2, ' ' + UM)} {t('vs publié')}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="note" style={{ marginTop: 12 }}>{t('Un retraitement déjà inclus par le vendeur est retiré tant qu’il n’est pas accepté. Un retraitement non inclus n’est ajouté qu’une fois accepté.')}</p>
        </Card>
        <Card title={t('Indicateurs & bilan')} icon="repeat">
          <div className="form">
            {kfield('ARR', ['kpi', 'arr'], d.kpi.arr, UM, { ref: d.refs.arr })}
            {kfield(t('Revenus récurrents'), ['kpi', 'recurring'], d.kpi.recurring, '%', { d: 0, ref: d.refs.recurring })}
            {kfield(t('Churn clients'), ['kpi', 'churn'], d.kpi.churn, '%', { ref: d.refs.churn })}
            {kfield(t('Rétention nette (NRR)'), ['kpi', 'nrr'], d.kpi.nrr, '%', { d: 0 })}
            {kfield(t('Top 10 clients'), ['kpi', 'top10'], d.kpi.top10, t('% du CA'), { d: 0, ref: d.refs.top10 })}
            {kfield(t('Nombre de clients'), ['kpi', 'customers'], d.kpi.customers, '', { d: 0 })}
            {kfield(t('Dette nette'), ['bs', 'netDebt'], d.bs.netDebt, UM, { ref: d.refs.netDebt })}
            {kfield(t('Éléments assimilés à la dette'), ['bs', 'debtLike'], d.bs.debtLike, UM)}
            {kfield(t('VE demandée (100 %)'), ['askPrice'], d.askPrice, UM, { ref: d.refs.askPrice })}
            {kfield(t('Effectif'), ['kpi', 'employees'], d.kpi.employees, t('ETP'), { d: 0 })}
          </div>
        </Card>
      </Reveal>

      <Reveal index={2}>
        <Card className="mt" title={t('Plan d’affaires autonome')} icon="trend" sub={t('hors synergies')}>
          <div className="form">
            {d.plan.growth.map((v, i) => <span key={i} style={{ display: 'contents' }}>{kfield(t('Croissance {0}', (b.year || 0) + i + 1), ['plan', 'growth', String(i)], v, '%')}</span>)}
            {kfield(t('Marge d’EBITDA cible (an {0})', d.plan.growth.length), ['plan', 'targetMargin'], d.plan.targetMargin, '%', { ph: b.margin == null ? '—' : nf(b.margin) })}
            {kfield(t('Croissance au-delà'), ['plan', 'longGrowth'], d.plan.longGrowth, '%')}
            {kfield('Capex', ['plan', 'capexPct'], d.plan.capexPct, t('% du CA'))}
            {kfield(t('Amortissements'), ['plan', 'daPct'], d.plan.daPct, t('% du CA'))}
            {kfield(t('BFR'), ['plan', 'nwcPct'], d.plan.nwcPct, t('% du CA'))}
            {kfield(t('Taux d’IS'), ['plan', 'taxRate'], d.plan.taxRate, '%')}
          </div>
          <p className="note" style={{ marginTop: 14 }}>{t('La marge progresse linéairement de la marge retenue ({0}) vers la cible. Un BFR négatif (abonnements facturés d’avance) génère de la trésorerie quand le CA croît. Ce plan alimente le DCF et le modèle de rendement.', b.margin == null ? '—' : pc(b.margin))}</p>
        </Card>
      </Reveal>
    </>
  );
}
