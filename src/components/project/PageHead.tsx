'use client';
import Link from 'next/link';
import { useState } from 'react';
import { decisionLabel, phaseLabel } from '../../domain/phases';
import { DEFAULT_TEMPLATES, suggestTemplate, type Template, type TemplateKey } from '../../domain/templates';
import { waitsFor } from '../../domain/waits';
import { exportMemo } from '../../lib/exports/memo';
import { exportXlsx } from '../../lib/exports/xlsx';
import { useApp, useI18n } from '../../lib/repo-context';
import { ImDialog } from '../dossiers/ImDialog';
import { MessageDialog } from '../messages/MessageDialog';
import { Icon } from '../ui/Icon';
import { useProject } from './ProjectContext';

export function PageHead() {
  const { deal: d, meta, members, c, id, editable, mandate } = useProject();
  const { toast, repo } = useApp();
  const { t, locale } = useI18n();
  const [im, setIm] = useState(false);
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const [msg, setMsg] = useState<{ key: TemplateKey; templates: Template[]; at: Date } | null>(null);
  const owner = members.find((m) => m.id === meta.ownerId);

  const memo = () => {
    try { toast(t('Fichier prêt : {0}', exportMemo(d, meta, c, locale))); }
    catch { toast(t('Le téléchargement n’est pas disponible ici.'), true); }
  };
  // Every phase, decided deals included: the no-go / due diligence messages are written from here.
  const message = async () => {
    const templates = await repo.templates().catch(() => DEFAULT_TEMPLATES);
    const at = new Date();
    const key = suggestTemplate(meta, waitsFor(d, meta, at), d) ?? 'info_request';
    setMsg({ key, templates: templates.length ? templates : DEFAULT_TEMPLATES, at });
  };
  const xlsx = async () => {
    setXlsxBusy(true);
    try { toast(t('Fichier prêt : {0}', await exportXlsx(d, meta, c, locale))); }
    catch { toast(t('Module Excel indisponible.'), true); }
    finally { setXlsxBusy(false); }
  };
  return (
    <>
      <div className="crumb">
        <Icon name="folder" /><Link href="/dossiers">{t('Mes dossiers')}</Link><Icon name="chev" /><strong>{d.name}</strong>
      </div>
      <div className="pagehead">
        <div>
          <div className="titleline">
            <h1>{d.name}</h1>
            {d.example && <span className="tag">{t('Dossier exemple')}</span>}
          </div>
          <div className="meta">
            <span><Icon name="building" />{d.sector || t('Secteur à préciser')}</span><i className="sep">·</i>
            <span><Icon name="pin" />{d.country || t('Pays à préciser')}</span><i className="sep">·</i>
            <span><Icon name="layers" /><span className={`tag ${meta.phase === 'decided' ? '' : 'amber'}`}>
              {phaseLabel(locale, meta.phase)}{meta.decision ? ` · ${decisionLabel(locale, meta.decision)}` : ''}
            </span></span>
            {owner && <><i className="sep">·</i><span><Icon name="user" />{t('Responsable')} : {owner.name}</span></>}
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={message}><Icon name="mail" />{t('Rédiger un message')}</button>
          <button type="button" className="btn" onClick={memo}><Icon name="file" />{t('Note de comité')}</button>
          <button type="button" className="btn" disabled={xlsxBusy} aria-busy={xlsxBusy || undefined} onClick={xlsx}><Icon name="download" />Excel</button>
          {editable && <button type="button" className="btn primary" onClick={() => setIm(true)}><Icon name="upload" />{t('Importer un IM')}</button>}
        </div>
      </div>
      {im && <ImDialog target={{ id, deal: d, editable }} onClose={() => setIm(false)} />}
      {msg && (
        <MessageDialog key={`${msg.key}:${locale}`} rec={{ deal: d, meta }} waits={waitsFor(d, meta, msg.at)} mandate={mandate}
          templates={msg.templates} initialKey={msg.key} onClose={() => setMsg(null)} />
      )}
    </>
  );
}
