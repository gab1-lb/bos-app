'use client';
import { InviteForm, Members } from '../../components/admin/Members';
import { MandateForm } from '../../components/admin/MandateForm';
import { TemplateEditor } from '../../components/admin/TemplateEditor';
import { AppShell } from '../../components/shell/AppShell';
import { Reveal } from '../../components/ui/Reveal';
import { useI18n, useMe } from '../../lib/repo-context';

function Admin() {
  const me = useMe();
  const { t } = useI18n();
  const allowed = me?.role === 'admin' && me.status === 'active';
  return (
    <div className="admin">
      <Reveal className="pagehead" index={0}>
        <div>
          <h1>{t('Administration')}</h1>
          <p className="note" style={{ marginTop: 10 }}>
            {!me ? '…' : allowed ? t('Membres de l’équipe, mandat acquéreur et modèles de messages.') : t('Réservé aux administrateurs.')}
          </p>
        </div>
      </Reveal>
      {allowed && (
        <>
          <Reveal index={1}><Members /></Reveal>
          <Reveal className="g2e mt" index={2}>
            <InviteForm />
            <MandateForm />
          </Reveal>
          <Reveal className="mt" index={3}><TemplateEditor /></Reveal>
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  return <AppShell><Admin /></AppShell>;
}
