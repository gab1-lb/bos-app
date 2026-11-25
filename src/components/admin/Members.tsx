'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Member, MemberStatus, Role } from '../../domain/permissions';
import { useApp, useI18n } from '../../lib/repo-context';
import { Avatar } from '../ui/Avatar';
import { Card } from '../ui/Card';
import { Chip, type Tone } from '../ui/Chip';
import { Icon } from '../ui/Icon';

export const ROLES: Role[] = ['admin', 'associate', 'analyst', 'reader'];
export const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', associate: 'Associate', analyst: 'Analyste', reader: 'Lecteur' };
const STATUS_LABEL: Record<MemberStatus, [string, Tone]> = { active: ['Actif', 'good'], pending: ['En attente', 'amber'], denied: ['Refusé', 'bad'] };
const ORDER: Record<MemberStatus, number> = { pending: 0, active: 1, denied: 2 };

/** Membres : approuver un « en attente » avec un rôle, refuser, changer de rôle, retirer ou rendre l'accès. */
export function Members() {
  const { repo, me, toast } = useApp();
  const { t } = useI18n();
  const [list, setList] = useState<Member[] | null>(null);
  const [choice, setChoice] = useState<Record<string, Role>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const m = await repo.members();
      setList([...m].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name)));
    } catch {
      setList([]);
      toast(t('Chargement impossible. Réessayez dans un instant.'), true);
    }
  }, [repo, toast, t]);
  useEffect(() => { void load(); }, [load]);

  const update = async (m: Member, patch: Partial<Pick<Member, 'role' | 'status'>>, msg: string) => {
    setBusy(m.id);
    try {
      await repo.setMember(m.id, patch);
      toast(msg);
    } catch (e) {
      toast(t('Action impossible : {0}', (e as Error)?.message ?? ''), true);
    } finally {
      setBusy(null);
      void load();
    }
  };

  const pending = list?.filter((m) => m.status === 'pending').length ?? 0;
  return (
    <Card title={t('Membres')} icon="users" sub={list ? (pending ? t('{0} en attente', pending) : String(list.length)) : ''}>
      {!list ? <div className="loading" aria-busy="true">…</div> : list.length === 0 ? <div className="empty">{t('Aucun membre.')}</div> : (
        <div className="tw">
          <table className="members">
            <thead><tr><th>{t('Membre')}</th><th>{t('Statut')}</th><th>{t('Rôle')}</th><th><span className="sr-only">{t('Actions')}</span></th></tr></thead>
            <tbody>
              {list.map((m) => {
                const self = m.id === me?.id;
                const [label, tone] = STATUS_LABEL[m.status];
                const role: Role | '' = m.status === 'active' ? m.role ?? '' : choice[m.id] ?? m.role ?? 'analyst';
                const off = busy === m.id;
                const roleName = role ? t(ROLE_LABEL[role]) : '';
                return (
                  <tr key={m.id} data-member={m.id} className={m.status}>
                    <td>
                      <span className="person">
                        <Avatar member={m} decorative size="sm" />
                        <span><span>{m.name || m.email}{self && <small> · {t('vous')}</small>}</span><span className="mini">{m.email}</span></span>
                      </span>
                    </td>
                    <td><Chip tone={tone}>{t(label)}</Chip></td>
                    <td>
                      <select className="in" aria-label={t('Rôle')} value={role} disabled={self || off}
                        title={self ? t('Vous ne pouvez pas changer votre propre rôle.') : undefined}
                        onChange={(e) => {
                          const r = e.target.value as Role;
                          if (m.status === 'active') void update(m, { role: r }, t('Rôle de {0} : {1}', m.name, t(ROLE_LABEL[r])));
                          else setChoice((c) => ({ ...c, [m.id]: r }));
                        }}>
                        {role === '' && <option value="" disabled>{t('Rôle à définir')}</option>}
                        {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_LABEL[r])}</option>)}
                      </select>
                    </td>
                    <td className="n">
                      {!self && (
                        <span className="rowacts">
                          {m.status !== 'active' && (
                            <button type="button" className="btn sm primary" disabled={off}
                              onClick={() => role && update(m, { role, status: 'active' }, t('{0} approuvé comme {1}', m.name, roleName))}>
                              <Icon name="shield" />{t(m.status === 'pending' ? 'Approuver' : 'Rétablir l’accès')}
                            </button>
                          )}
                          {m.status === 'pending' && (
                            <button type="button" className="btn sm danger" disabled={off}
                              onClick={() => update(m, { status: 'denied' }, t('Accès refusé à {0}', m.name))}>{t('Refuser')}</button>
                          )}
                          {m.status === 'active' && (
                            <button type="button" className="btn sm danger" disabled={off}
                              onClick={() => update(m, { status: 'denied' }, t('Accès retiré à {0}', m.name))}>{t('Retirer l’accès')}</button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invitation d'une personne hors du domaine de l'entreprise, avec son rôle. */
export function InviteForm() {
  const { repo, toast } = useApp();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('analyst');
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState(false);

  const send = async () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL.test(e)) { setBad(true); toast(t('Adresse e-mail invalide.'), true); return; }
    setBusy(true);
    try {
      await repo.invite(e, role);
      toast(t('Invitation enregistrée : {0} ({1})', e, t(ROLE_LABEL[role])));
      setEmail('');
    } catch (err) {
      toast(t('Action impossible : {0}', (err as Error)?.message ?? ''), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t('Inviter une personne')} icon="mail">
      <form className="stack" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <p className="note">{t('Pour une personne hors du domaine de l’entreprise (conseil, partenaire). Elle reçoit ce rôle dès sa première connexion avec Google, sans attendre d’approbation.')}</p>
        <div className="invite">
          <div className="field">
            <label htmlFor="invite-email">{t('E-mail à inviter')}</label>
            <input id="invite-email" type="email" className="in txt" value={email} autoComplete="off" placeholder="prenom.nom@exemple.fr"
              aria-invalid={bad || undefined} onChange={(e) => { setEmail(e.target.value); setBad(false); }} />
          </div>
          <div className="field">
            <label htmlFor="invite-role">{t('Rôle de l’invité')}</label>
            <select id="invite-role" className="in" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_LABEL[r])}</option>)}
            </select>
          </div>
          <button type="submit" className="btn primary" disabled={busy || !email.trim()}><Icon name="send" />{t('Inviter')}</button>
        </div>
      </form>
    </Card>
  );
}
