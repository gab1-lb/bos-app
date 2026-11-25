'use client';
import { notFound, useParams } from 'next/navigation';
import { Activite } from '../../../../components/project/Activite';
import { Demandes } from '../../../../components/project/Demandes';
import { Financiers } from '../../../../components/project/Financiers';
import { Rendement } from '../../../../components/project/Rendement';
import { Synthese } from '../../../../components/project/Synthese';
import { Valorisation } from '../../../../components/project/Valorisation';

const VIEWS = { synthese: Synthese, financiers: Financiers, valorisation: Valorisation, rendement: Rendement, demandes: Demandes, activite: Activite };

export default function ProjectTabPage() {
  const { tab } = useParams<{ tab: string }>();
  // Own keys only: /projet/x/constructor must be a 404, not Object.prototype.constructor.
  if (!Object.hasOwn(VIEWS, tab)) notFound();
  const View = VIEWS[tab as keyof typeof VIEWS];
  return <View />;
}
