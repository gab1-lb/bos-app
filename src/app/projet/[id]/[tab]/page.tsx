'use client';
import { notFound, useParams } from 'next/navigation';
import { useEffect } from 'react';
import { Activite } from '../../../../components/project/Activite';
import { Demandes } from '../../../../components/project/Demandes';
import { Financiers } from '../../../../components/project/Financiers';
import { Rendement } from '../../../../components/project/Rendement';
import { Synthese } from '../../../../components/project/Synthese';
import { Valorisation } from '../../../../components/project/Valorisation';
import { markDemo } from '../../../../lib/demo/progress';

const VIEWS = { synthese: Synthese, financiers: Financiers, valorisation: Valorisation, rendement: Rendement, demandes: Demandes, activite: Activite };

/** Lien « …/financiers#f-hist.rev.0 » : amène l'élément au centre de l'écran et y place le curseur. */
function useFocusHash(tab: string) {
  useEffect(() => {
    const target = decodeURIComponent(window.location.hash.slice(1));
    if (!target) return;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(target);
      if (!el) return;
      el.scrollIntoView({ block: 'center' });
      const field = el.matches('input, textarea, select, button')
        ? el
        : el.querySelector<HTMLElement>('input:not([readonly]):not([disabled]), button:not([disabled])');
      field?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [tab]);
}

export default function ProjectTabPage() {
  const { tab } = useParams<{ tab: string }>();
  useFocusHash(tab);
  // Demo "À essayer" checklist: a Synthèse seen.
  useEffect(() => { if (tab === 'synthese') markDemo('synthese'); }, [tab]);
  // Own keys only: /projet/x/constructor must be a 404, not Object.prototype.constructor.
  if (!Object.hasOwn(VIEWS, tab)) notFound();
  const View = VIEWS[tab as keyof typeof VIEWS];
  return <View />;
}
