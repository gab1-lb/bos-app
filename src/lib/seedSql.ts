/* Génère supabase/seed.sql et supabase/seed-demo.sql à partir des sources TypeScript,
 * pour que les fichiers SQL ne divergent jamais (`npm run gen:seed`, vérifié par seedSql.test.ts). */
import { DEFAULT_MANDATE, demoDeal } from '../engine/samples';
import { DEFAULT_TEMPLATES } from '../domain/templates';

const TAG = '$bos$';
const dq = (s: string): string => {
  if (s.includes(TAG)) throw new Error('texte contenant ' + TAG);
  return TAG + s + TAG;
};
const lit = (s: string): string => "'" + s.replace(/'/g, "''") + "'";

export const DEMO_DEAL_UUID = '00000000-0000-4000-8000-000000000001';

export function buildSeedSql(): string {
  const tpl = DEFAULT_TEMPLATES.map((t) => `  (${lit(t.key)}, ${lit(t.locale)}, ${dq(t.subject)}, ${dq(t.body)})`).join(',\n');
  return `-- BOS : données initiales. GÉNÉRÉ par \`npm run gen:seed\` (scripts/gen-seed.ts) : ne pas modifier à la main.
-- À exécuter dans Supabase (SQL Editor) APRÈS supabase/migrations/0001_init.sql.
--
-- AVANT D'EXÉCUTER, remplacez les deux valeurs ci-dessous (gardez les apostrophes) :
--   __ALLOWED_DOMAIN__  -> le domaine e-mail de votre entreprise, sans @   (ex. : monentreprise.com)
--   __ADMIN_EMAIL__     -> l'adresse e-mail Google du premier administrateur (ex. : prenom.nom@monentreprise.com)

insert into public.app_settings (id, allowed_domain, bootstrap_admin_email)
values (1, '__ALLOWED_DOMAIN__', '__ADMIN_EMAIL__')
on conflict (id) do update
  set allowed_domain = excluded.allowed_domain,
      bootstrap_admin_email = excluded.bootstrap_admin_email;

-- Mandat d'investissement par défaut (modifiable ensuite dans l'application).
insert into public.mandate (id, data)
values (1, ${dq(JSON.stringify(DEFAULT_MANDATE))}::jsonb)
on conflict (id) do nothing;

-- Modèles d'e-mails par défaut (6 en français, 6 en anglais).
insert into public.templates (key, locale, subject, body) values
${tpl}
on conflict (key, locale) do nothing;
`;
}

export function buildDemoSeedSql(): string {
  const d = { ...demoDeal(), id: DEMO_DEAL_UUID, updatedAt: 0 }; // updatedAt figé : sortie déterministe
  return `-- BOS : dossier d'exemple « ${d.name} » (facultatif). GÉNÉRÉ par \`npm run gen:seed\` : ne pas modifier à la main.
-- À exécuter APRÈS la première connexion de l'administrateur (son compte doit exister dans la table members).
-- Le dossier lui est attribué. Sans effet si le dossier existe déjà.

do $do$
declare v_admin uuid;
begin
  select m.id into v_admin
  from public.members m
  join public.app_settings s on s.id = 1 and lower(m.email) = lower(trim(s.bootstrap_admin_email));
  if v_admin is null then
    raise exception 'Administrateur introuvable : connectez-vous d''abord à BOS avec l''adresse e-mail administrateur, puis relancez ce script.';
  end if;
  if exists (select 1 from public.deals where id = '${DEMO_DEAL_UUID}') then
    return;
  end if;
  insert into public.deals (id, data, owner_id, phase, phase_entered_at, updated_at, updated_by)
  values ('${DEMO_DEAL_UUID}', ${dq(JSON.stringify(d))}::jsonb, v_admin, 'analysis', now(), now(), v_admin);
  insert into public.activity (deal_id, actor_id, kind, path, old_value, new_value)
  values ('${DEMO_DEAL_UUID}', v_admin, 'create', null, null, jsonb_build_object('name', ${lit(d.name)}));
end
$do$;
`;
}
