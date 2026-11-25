'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n, useMe, useRepo } from '../../lib/repo-context';
import { Icon, Logo, type IconName } from '../ui/Icon';
import { LocaleSwitch } from './LocaleSwitch';
import { SignOutButton } from './SignOutButton';
import { getLastDeal } from './lastDeal';

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export function TopBar() {
  const repo = useRepo();
  const me = useMe();
  const { t } = useI18n();
  const path = usePathname();
  const [projectHref, setProjectHref] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const fromPath = path.match(/^\/projet\/([^/]+)/)?.[1];
    const last = fromPath ? decodeURIComponent(fromPath) : getLastDeal();
    // Only the last deal is checked; the whole list is read only when there is no (valid) last deal.
    (async () => {
      const found = last ? await repo.getDeal(last).catch(() => null) : null;
      const id = found ? found.meta.id : (await repo.listDeals())[0]?.meta.id;
      if (live) setProjectHref(id ? `/projet/${encodeURIComponent(id)}/synthese` : null);
    })().catch(() => {});
    return () => { live = false; };
  }, [repo, path]);

  const items: [string, string, IconName, boolean][] = [
    ['/', t('Accueil'), 'home', path === '/'],
    [projectHref ?? '/dossiers', t('Mon projet'), 'layout', path.startsWith('/projet')],
    ['/dossiers', t('Mes dossiers'), 'folder', path.startsWith('/dossiers')],
  ];
  if (me?.role === 'admin') items.push(['/admin', t('Administration'), 'shield', path.startsWith('/admin')]);

  return (
    <header className="topbar">
      <div className="wrap">
        <Link className="brand" href="/" aria-label="BOS"><Logo />BOS</Link>
        <i className="vdiv" />
        <nav className="nav" aria-label={t('Navigation principale')}>
          {items.map(([href, label, icon, on]) => (
            <Link key={label} href={href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
              <Icon name={icon} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="right">
          <LocaleSwitch />
          {me && (
            <span className="who">
              <span className="personal">{me.name}</span>
              <span className="avatar" title={me.name}>{initials(me.name) || <Icon name="user" />}</span>
            </span>
          )}
          <SignOutButton className="signout" label={t('Se déconnecter')} />
        </div>
      </div>
    </header>
  );
}
