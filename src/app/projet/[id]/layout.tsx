'use client';
import { useParams } from 'next/navigation';
import { PageHead } from '../../../components/project/PageHead';
import { ProjectProvider, useProject } from '../../../components/project/ProjectContext';
import { Tabs } from '../../../components/shell/Tabs';

function Head() {
  const { deal, id } = useProject();
  const { tab } = useParams<{ tab?: string }>();
  const open = (deal.questions || []).filter((q) => q.status !== 'Répondue').length;
  return (
    <>
      <PageHead />
      <Tabs dealId={id} current={tab ?? 'synthese'} openCount={open} />
    </>
  );
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const dealId = decodeURIComponent(id);
  return (
    <ProjectProvider key={dealId} id={dealId}>
      <Head />
      {children}
    </ProjectProvider>
  );
}
