'use client';
import Link from 'next/link';
import { N } from '../../engine/finance';
import type { Criterion } from '../../engine/types';
import { can } from '../../domain/permissions';
import { phaseLabel, suggestNextPhase } from '../../domain/phases';
import { useI18n, type I18n } from '../../lib/repo-context';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { CountUp } from '../ui/CountUp';
import { Icon } from '../ui/Icon';
import { Metric } from '../ui/Metric';
import { Reveal } from '../ui/Reveal';
import { Gauges } from '../valuation/Gauges';
import { gaugeLabels } from './compute';
import { useProject } from './ProjectContext';
import { MKEY, TAG, VCLS, headlineKey, reasonText } from './verdict';

const ok = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);
function Delta({ cur, prev, pts, f }: { cur: number | null; prev: number | null; pts?: boolean; f: I18n }) {
  if (!ok(cur) || !ok(prev) || prev === 0) return null;
  const v = pts ? cur - prev : 100 * (cur / prev - 1);
  return <span className={v >= 0 ? 'up' : 'down'}>{f.sg(v, 1, pts ? ' pts' : undefined)}</span>;
}

export function Synthese() {
  const { deal: d, meta, c, me, act, id } = useProject();
  const f = useI18n();
  const { t, meur, pc, mx } = f;
  const { b, ret, sc, cp, mp } = c;
  const h = d.hist, L = h.years.length - 1, prevY = h.years[L - 1];
  const base = `/projet/${encodeURIComponent(id)}`;
  const open = (d.questions || []).filter((q) => q.status !== 'Répondue')
    .sort((x, y) => (x.priority === 'Décisive' ? 0 : 1) - (y.priority === 'Décisive' ? 0 : 1));
  const margins = h.rev.map((r, i) => (r != null && r > 0 && ok(N(h.ebitda[i])) ? (100 * (h.ebitda[i] as number)) / r : null));
  const known = sc.crit.filter((k) => k.pts != null).length;
  const headline = headlineKey(sc);
  const next = suggestNextPhase(meta, sc);
  const canNext = next && me && can(me, `setPhase:${next}`, meta);
  const sig = (k: Criterion) => k.pts == null ? <Chip tone="amber">{t('À obtenir')}</Chip>
    : k.pts === 2 ? <Chip tone="good">{t('Favorable')}</Chip> : k.pts === 1 ? <Chip>{t('Neutre')}</Chip> : <Chip tone="bad">{t('Défavorable')}</Chip>;
  const fv = (k: Criterion) => (k.v == null ? t('donnée manquante') : k.unit === '%' ? pc(k.v) : mx(k.v, 2));
  const gRows = c.rows.map((r) => ({ ...r, ...gaugeLabels(r, c, d, f) }));

  return (
    <>
      {next && (
        <Reveal className="suggest" index={0}>
          <span className="iconbox"><Icon name="flag" /></span>
          <span><b>{t('Passer en {0} ?', phaseLabel(f.locale, next))}</b> {t('Les données clés sont renseignées et un prix est connu.')}</span>
          {canNext && (
            <button type="button" className="btn sm primary" onClick={() => act((r, i) => r.setPhase(i, next))}>
              {t('Passer en {0}', phaseLabel(f.locale, next))}
            </button>
          )}
        </Reveal>
      )}

      <div className="g2">
        <Reveal as="section" className="hero" index={1}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="terrain" src="/terrain.svg" alt="" />
          <div className="eyebrow"><Icon name="activity" />{t('Avis préliminaire')}</div>
          <h2>{t(headline)}</h2>
          <p>{sc.reasons.map((r) => reasonText(r, f)).join(' ')}</p>
          <div className="herofoot">
            <span className={`signal ${VCLS[sc.code]}`}>{t(TAG[sc.code])}</span>
            <span className="score">{t('Note')} <b>{sc.score == null ? '—' : <CountUp value={sc.score} format={(n) => String(Math.round(n))} />}</b> / 100{sc.provisional ? ' · ' + t('provisoire') : ''}</span>
          </div>
        </Reveal>
        <Reveal as="section" className="card source" index={2}>
          <div className="cardhead" style={{ margin: 0 }}><h2>{t('Document source')}</h2><span className="iconbox"><Icon name="file" /></span></div>
          <div className="doc">
            <span className="pdficon"><Icon name="file" /></span>
            <span><b>{d.source || t('Aucun IM importé')}</b><small>{d.source ? t('Information Memorandum') : t('Importer un PDF ou coller des extraits')}</small></span>
          </div>
          <div>
            <div className="rowsb"><span>{t('Couverture des données')}</span><b>{known} / {sc.crit.length}</b></div>
            <div className="progress"><i className="grow" style={{ width: `${Math.round(sc.coverage * 100)}%`, animationDelay: '200ms' }} /></div>
          </div>
        </Reveal>
      </div>

      <Reveal className="sectionhead" index={3}>
        <h2>{t('Indicateurs clés')}</h2>
        <span className="period"><Icon name="cal" />{t('Exercice')} {b.year || '—'}</span>
      </Reveal>
      <Reveal className="g4" index={4}>
        <Metric label={t('Chiffre d’affaires')} icon="chart" naLabel={t('À obtenir')} href={`${base}/financiers`}
          value={ok(b.rev) ? <CountUp value={b.rev} format={(n) => meur(n)} /> : null}
          foot={ok(b.revPrev) ? <><Delta cur={b.rev} prev={b.revPrev} f={f} /> {t('vs {0}', prevY)}</> : null}
          spark={h.rev.map(N)} />
        <Metric label={t('EBITDA retenu')} icon="coins" naLabel={t('À obtenir')} href={`${base}/financiers`}
          value={ok(b.adjEbitda) ? <CountUp value={b.adjEbitda} format={(n) => meur(n, 2)} /> : null}
          foot={b.adjNet ? t('publié {0}', meur(b.ebitda as number, 2)) : ok(N(h.ebitda[L - 1])) ? <><Delta cur={N(h.ebitda[L])} prev={N(h.ebitda[L - 1])} f={f} /> {t('vs {0}', prevY)}</> : null}
          spark={h.ebitda.map(N)} />
        <Metric label={t('Marge d’EBITDA')} icon="percent" naLabel={t('À obtenir')} href={`${base}/financiers`}
          value={ok(b.margin) ? <CountUp value={b.margin} format={(n) => pc(n)} /> : null}
          foot={ok(b.marginPrev) && ok(b.margin) ? <><Delta cur={b.margin} prev={b.marginPrev} pts f={f} /> {t('vs {0}', prevY)}</> : null}
          spark={margins} />
        <Metric label={t('Revenus récurrents')} icon="repeat" naLabel={t('À obtenir')} href={`${base}/financiers`}
          value={ok(b.recurring) ? <CountUp value={b.recurring} format={(n) => pc(n, 0)} /> : null}
          foot={[ok(b.arr) ? 'ARR ' + meur(b.arr) : '', ok(b.churn) ? t('churn {0}', pc(b.churn)) : ''].filter(Boolean).join(' · ')} />
      </Reveal>

      <Reveal className="g2e mt" index={5}>
        <Link className="card wide" href={`${base}/valorisation`}>
          <span className="iconbox"><Icon name="coins" /></span>
          <span>
            <small>{t('Prix demandé par le vendeur')}</small>
            <strong>{ok(b.ask) ? `${meur(b.ask)} · ${mx(b.askEvEbitda as number)} EBITDA` : t('À obtenir')}</strong>
            <span className="mini">{cp.evEbitda.n && ok(b.adjEbitda) ? t('Médiane des transactions : {0} · {1}', mx(cp.evEbitda.med!), meur(cp.evEbitda.med! * b.adjEbitda)) : t('Ajoutez des transactions comparables')}</span>
          </span>
          <Icon name="chev" />
        </Link>
        <Link className="card wide" href={`${base}/rendement`}>
          <span className="iconbox"><Icon name="trend" /></span>
          <span>
            <small>{t('Rendement pour l’acquéreur')}</small>
            <strong>{ret && ret.irr != null ? `${t('TRI {0}', pc(ret.irr * 100))} · ${mx(ret.mom, 2)}` : t('À calculer')}</strong>
            <span className="mini">{ret ? t('Seuil {0} · prix max {1} · ROIC an 5 {2}', pc(c.hurdle, 0), mp == null ? '—' : meur(mp), pc(ret.roic5 * 100)) : t('Indiquez un prix pour calculer le rendement')}</span>
          </span>
          <Icon name="chev" />
        </Link>
      </Reveal>

      <Reveal className="g2b mt" index={6}>
        <Card title={t('Valorisation')} icon="scale" right={<Link className="link" href={`${base}/valorisation`}>{t('Détail')}<Icon name="chev" /></Link>}>
          <Gauges compact rows={gRows} marks={{ ask: b.ask, entry: ret ? ret.ev : null }}
            emptyText={t('Renseignez le CA, l’EBITDA et au moins un comparable pour afficher les fourchettes.')} />
        </Card>
        <Card title={t('Informations à obtenir')} icon="inbox" right={open.length ? <Chip tone="amber">{t('{0} en attente', open.length)}</Chip> : null}>
          {open.length ? (
            <>
              {open.slice(0, 4).map((q, i) => (
                <div className="ask" key={i}>
                  <span className={`askicon ${q.priority === 'Décisive' ? 'red' : ''}`}><Icon name="file" /></span>
                  <div><b>{q.q || '—'}</b><span className="mini">{t(q.cat)} · {t(q.priority)} · {t(q.status)}</span></div>
                </div>
              ))}
              <Link className="link" href={`${base}/demandes`} style={{ marginTop: 12 }}>{t('Voir les demandes')}<Icon name="chev" /></Link>
            </>
          ) : <div className="empty">{t('Toutes les demandes ont reçu une réponse.')}</div>}
        </Card>
      </Reveal>

      <Reveal className="g2b mt" index={7}>
        <Card title={t('Facteurs de décision')} icon="scale">
          <div className="thead"><span>{t('Facteur analysé')}</span><span>{t('Signal')}</span></div>
          {sc.crit.map((k) => (
            <div className="factor" key={k.k}>
              <div><strong>{t(k.label)}</strong><span className="mini">{t(k.hint)} · {fv(k)}</span></div>
              {sig(k)}
            </div>
          ))}
        </Card>
        <Card title={t('Thèse d’investissement')} icon="flag" right={<Link className="link" href={`${base}/demandes`}>{t('Modifier')}<Icon name="chev" /></Link>}>
          <div className="prose stack" style={{ gap: 18 }}>
            <div><h3>{t('Pourquoi acheter')}</h3><p>{d.thesis || <span className="dim">{t('À rédiger')}</span>}</p></div>
            <div><h3>{t('Ce qui invaliderait la thèse')}</h3><p>{d.risks || <span className="dim">{t('À rédiger')}</span>}</p></div>
            <div>
              <h3>{t('Mandat')}</h3>
              {sc.mandate.map((m) => (
                <div className="factor" key={m.key} style={{ padding: '8px 0', fontSize: 13.5 }}>
                  <span>{t(MKEY[m.key])}{m.param != null ? ' · ' + (m.key.includes('Rev') ? meur(m.param, 0) : pc(m.param, 0)) : ''}</span>
                  {m.state === 'ok' ? <Chip tone="good">{t('Conforme')}</Chip> : m.state === 'ko' ? <Chip tone="bad">{t('Hors mandat')}</Chip> : <Chip tone="amber">{t('Inconnu')}</Chip>}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </Reveal>
    </>
  );
}
