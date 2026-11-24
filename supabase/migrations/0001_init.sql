-- BOS: schema, row-level security, state functions and signup rules.
--
-- Security model
--   * Every table has RLS enabled. Members whose status is not 'active' (or who have no
--     role) see no rows at all; anon sees nothing.
--   * deals / activity are read-only for clients: every write goes through the
--     SECURITY DEFINER functions below, which re-check the rules of
--     src/domain/permissions.ts (can()) themselves and log to `activity`.
--   * members / invites / mandate / templates / app_settings are writable by admins only.
--   * Permission failures raise SQLSTATE 42501 (insufficient_privilege); bad arguments or
--     wrong state raise 22023 (invalid_parameter_value); unknown deal raises P0002.

-- =====================================================================================
-- Tables
-- =====================================================================================

create table public.app_settings (
  id int primary key default 1 check (id = 1),
  allowed_domain text not null,
  bootstrap_admin_email text not null
);

create table public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '',
  avatar_url text,
  role text check (role in ('admin', 'associate', 'analyst', 'reader')),
  status text not null default 'pending' check (status in ('pending', 'active', 'denied')),
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  -- true once role/status was set by a person (admin); automatic signup rules then leave it alone
  status_locked boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.invites (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('admin', 'associate', 'analyst', 'reader')),
  invited_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.mandate (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);

create table public.templates (
  key text not null,
  locale text not null check (locale in ('fr', 'en')),
  subject text not null default '',
  body text not null default '',
  updated_by uuid references public.members (id) on delete set null,
  primary key (key, locale)
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  owner_id uuid references public.members (id),
  contributor_ids uuid[] not null default '{}',
  phase text not null default 'im_received'
    check (phase in ('im_received', 'analysis', 'bote_written', 'associate_review', 'committee', 'decided')),
  phase_entered_at timestamptz not null default now(),
  decision text check (decision in ('go_dd', 'indicative_offer', 'no_go')),
  decided_at timestamptz,
  committee_date date,
  validated_by uuid references public.members (id),
  validated_at timestamptz,
  archived boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.members (id)
);

create table public.activity (
  id bigserial primary key,
  deal_id uuid references public.deals (id) on delete set null,
  actor_id uuid,
  at timestamptz not null default now(),
  kind text not null,
  path text,
  old_value jsonb,
  new_value jsonb
);
create index activity_deal_at_idx on public.activity (deal_id, at desc);

-- =====================================================================================
-- Identity helpers
-- =====================================================================================

create function public.current_member() returns public.members
language sql stable security definer set search_path = public as $$
  select * from public.members where id = auth.uid();
$$;

create function public.has_role(roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members
    where id = auth.uid() and status = 'active' and role = any (roles)
  );
$$;

-- Internal: raise 42501 unless the caller is an active member with one of `roles`.
create function public._require(roles text[]) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(roles) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
end $$;

-- Internal: lock and return a deal, or raise P0002.
create function public._lock_deal(p_id uuid) returns public.deals
language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  select * into d from public.deals where id = p_id for update;
  if not found then
    raise exception 'deal % not found', p_id using errcode = 'P0002';
  end if;
  return d;
end $$;

-- Internal: append an activity row.
create function public._log(p_deal uuid, p_kind text, p_path text, p_old jsonb, p_new jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.activity (deal_id, actor_id, kind, path, old_value, new_value)
  values (p_deal, auth.uid(), p_kind, p_path, p_old, p_new);
$$;

-- =====================================================================================
-- Deal state functions
-- =====================================================================================

-- create: analyst, associate, admin. Owner = caller, phase im_received.
create function public.create_deal(p_data jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := gen_random_uuid();
begin
  perform public._require(array['admin', 'associate', 'analyst']);
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'deal data must be a JSON object' using errcode = '22023';
  end if;
  insert into public.deals (id, data, owner_id, phase, phase_entered_at, updated_at, updated_by)
  values (v_id, p_data || jsonb_build_object('id', v_id::text), auth.uid(), 'im_received', now(), now(), auth.uid());
  perform public._log(v_id, 'create', null, null, jsonb_build_object('name', p_data -> 'name'));
  return v_id;
end $$;

-- import: associate, admin. Keeps phase/decision/dates from p_meta (camelCase, as produced
-- by importLegacy); owner = caller (importer).
create function public.import_deal(p_data jsonb, p_meta jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := gen_random_uuid();
  v_meta jsonb := coalesce(p_meta, '{}'::jsonb);
  v_phase text := coalesce(v_meta ->> 'phase', 'im_received');
  v_decision text := v_meta ->> 'decision';
begin
  perform public._require(array['admin', 'associate']);
  if p_data is null or jsonb_typeof(p_data) <> 'object' or jsonb_typeof(v_meta) <> 'object' then
    raise exception 'deal data and meta must be JSON objects' using errcode = '22023';
  end if;
  if v_phase not in ('im_received', 'analysis', 'bote_written', 'associate_review', 'committee', 'decided') then
    raise exception 'unknown phase %', v_phase using errcode = '22023';
  end if;
  if v_decision is not null and v_decision not in ('go_dd', 'indicative_offer', 'no_go') then
    raise exception 'unknown decision %', v_decision using errcode = '22023';
  end if;
  if (v_phase = 'decided') <> (v_decision is not null) then
    raise exception 'decision must be set iff phase is decided' using errcode = '22023';
  end if;
  insert into public.deals (id, data, owner_id, phase, phase_entered_at, decision, decided_at,
                            committee_date, archived, updated_at, updated_by)
  values (
    v_id,
    p_data || jsonb_build_object('id', v_id::text),
    auth.uid(),
    v_phase,
    coalesce((v_meta ->> 'phaseEnteredAt')::timestamptz, now()),
    v_decision,
    case when v_decision is not null then coalesce((v_meta ->> 'decidedAt')::timestamptz, now()) end,
    (v_meta ->> 'committeeDate')::date,
    coalesce((v_meta ->> 'archived')::boolean, false),
    now(),
    auth.uid()
  );
  perform public._log(v_id, 'import', null, null,
    jsonb_build_object('name', p_data -> 'name', 'legacyId', p_data -> 'id', 'phase', v_phase, 'decision', v_decision));
  return v_id;
end $$;

-- patch: analyst, associate, admin (edit right on every deal).
create function public.patch_deal(p_id uuid, p_path text[], p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.deals;
  v_value jsonb := coalesce(p_value, 'null'::jsonb);
  v_new jsonb;
begin
  perform public._require(array['admin', 'associate', 'analyst']);
  if p_path is null or coalesce(array_length(p_path, 1), 0) = 0 then
    raise exception 'empty path' using errcode = '22023';
  end if;
  if p_path[1] = 'id' then
    raise exception 'data.id is immutable' using errcode = '22023';
  end if;
  d := public._lock_deal(p_id);
  v_new := jsonb_set(d.data, p_path, v_value, true);
  if (v_new #> p_path) is distinct from v_value then
    raise exception 'path % has no parent in deal data', array_to_string(p_path, '.') using errcode = '22023';
  end if;
  update public.deals set data = v_new, updated_at = now(), updated_by = auth.uid() where id = p_id;
  perform public._log(p_id, 'patch', array_to_string(p_path, '.'), d.data #> p_path, v_value);
end $$;

-- set_phase: associate/admin to any phase except 'decided' (use decide());
-- analyst only from and to im_received / analysis / bote_written.
create function public.set_phase(p_id uuid, p_phase text) returns void
language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  perform public._require(array['admin', 'associate', 'analyst']);
  if p_phase is null or p_phase not in ('im_received', 'analysis', 'bote_written', 'associate_review', 'committee') then
    raise exception 'invalid target phase % (use decide() for decided)', p_phase using errcode = '22023';
  end if;
  if not public.has_role(array['admin', 'associate'])
     and p_phase not in ('im_received', 'analysis', 'bote_written') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  d := public._lock_deal(p_id);
  -- analysts move deals only within phases 1-3: the current phase must be one too
  if not public.has_role(array['admin', 'associate'])
     and d.phase not in ('im_received', 'analysis', 'bote_written') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if d.phase = p_phase then return; end if;
  update public.deals set
    phase = p_phase,
    phase_entered_at = now(),
    validated_by = case when p_phase in ('im_received', 'analysis', 'bote_written') then null else validated_by end,
    validated_at = case when p_phase in ('im_received', 'analysis', 'bote_written') then null else validated_at end,
    decision = null,
    decided_at = null,
    updated_at = now(),
    updated_by = auth.uid()
  where id = p_id;
  perform public._log(p_id, 'phase', null, to_jsonb(d.phase), to_jsonb(p_phase));
end $$;

-- validate_bote: associate/admin who is not the deal owner; deal must be in associate_review.
create function public.validate_bote(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  perform public._require(array['admin', 'associate']);
  d := public._lock_deal(p_id);
  if d.phase <> 'associate_review' then
    raise exception 'deal is not in associate_review' using errcode = '22023';
  end if;
  if d.owner_id = auth.uid() then
    raise exception 'permission denied: the owner cannot validate their own BOTe' using errcode = '42501';
  end if;
  update public.deals set validated_by = auth.uid(), validated_at = now(),
    updated_at = now(), updated_by = auth.uid()
  where id = p_id;
  perform public._log(p_id, 'validate', null, null, to_jsonb(auth.uid()));
end $$;

-- decide: associate/admin.
create function public.decide(p_id uuid, p_decision text) returns void
language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  perform public._require(array['admin', 'associate']);
  if p_decision is null or p_decision not in ('go_dd', 'indicative_offer', 'no_go') then
    raise exception 'unknown decision %', p_decision using errcode = '22023';
  end if;
  d := public._lock_deal(p_id);
  update public.deals set
    phase = 'decided',
    phase_entered_at = case when d.phase = 'decided' then phase_entered_at else now() end,
    decision = p_decision,
    decided_at = now(),
    updated_at = now(),
    updated_by = auth.uid()
  where id = p_id;
  perform public._log(p_id, 'decide', null, to_jsonb(d.decision), to_jsonb(p_decision));
end $$;

-- set_archived: associate/admin on any deal; analyst on deals they own.
create function public.set_archived(p_id uuid, p_value boolean) returns void
language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  perform public._require(array['admin', 'associate', 'analyst']);
  if p_value is null then
    raise exception 'archived must be true or false' using errcode = '22023';
  end if;
  d := public._lock_deal(p_id);
  if not public.has_role(array['admin', 'associate']) and d.owner_id is distinct from auth.uid() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  update public.deals set archived = p_value, updated_at = now(), updated_by = auth.uid() where id = p_id;
  perform public._log(p_id, 'archive', null, to_jsonb(d.archived), to_jsonb(p_value));
end $$;

-- delete_deal: associate/admin. The activity row survives (deal_id set null, id kept in old_value).
create function public.delete_deal(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  perform public._require(array['admin', 'associate']);
  d := public._lock_deal(p_id);
  perform public._log(p_id, 'delete', null, jsonb_build_object('id', d.id::text, 'name', d.data -> 'name'), null);
  delete from public.deals where id = p_id;
end $$;

-- set_committee_date: analyst, associate, admin (edit right).
create function public.set_committee_date(p_id uuid, p_date date) returns void
language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  perform public._require(array['admin', 'associate', 'analyst']);
  d := public._lock_deal(p_id);
  update public.deals set committee_date = p_date, updated_at = now(), updated_by = auth.uid() where id = p_id;
  perform public._log(p_id, 'committee', null, to_jsonb(d.committee_date), to_jsonb(p_date));
end $$;

-- set_contributors: analyst, associate, admin (edit right). Ids must be active members.
create function public.set_contributors(p_id uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.deals;
  v_ids uuid[] := coalesce((select array_agg(distinct x) from unnest(p_ids) x where x is not null), '{}');
begin
  perform public._require(array['admin', 'associate', 'analyst']);
  if exists (select 1 from unnest(v_ids) x
             where not exists (select 1 from public.members m where m.id = x and m.status = 'active')) then
    raise exception 'contributors must be active members' using errcode = '22023';
  end if;
  d := public._lock_deal(p_id);
  update public.deals set contributor_ids = v_ids, updated_at = now(), updated_by = auth.uid() where id = p_id;
  perform public._log(p_id, 'contributors', null, to_jsonb(d.contributor_ids), to_jsonb(v_ids));
end $$;

-- set_owner: associate/admin, not while in associate_review. New owner must be an active
-- analyst/associate/admin. Clears validated_* (a validation belongs to the previous owner's BOTe).
create function public.set_owner(p_id uuid, p_owner uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  perform public._require(array['admin', 'associate']);
  if not exists (select 1 from public.members
                 where id = p_owner and status = 'active' and role in ('admin', 'associate', 'analyst')) then
    raise exception 'owner must be an active analyst, associate or admin' using errcode = '22023';
  end if;
  d := public._lock_deal(p_id);
  -- otherwise a senior owner could hand the deal away mid-review and validate their own BOTe
  if d.phase = 'associate_review' then
    raise exception 'permission denied: owner cannot change during associate_review' using errcode = '42501';
  end if;
  update public.deals set owner_id = p_owner, validated_by = null, validated_at = null,
    updated_at = now(), updated_by = auth.uid()
  where id = p_id;
  perform public._log(p_id, 'owner', null, to_jsonb(d.owner_id), to_jsonb(p_owner));
end $$;

-- set_my_locale: any active member, own row only.
create function public.set_my_locale(p_locale text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._require(array['admin', 'associate', 'analyst', 'reader']);
  if p_locale is null or p_locale not in ('fr', 'en') then
    raise exception 'unknown locale %', p_locale using errcode = '22023';
  end if;
  update public.members set locale = p_locale where id = auth.uid();
end $$;

-- =====================================================================================
-- Signup: one members row per auth.users insert
--   Active branches need a confirmed e-mail (email_confirmed_at not null):
--     bootstrap_admin_email -> active admin; invited -> active + invite role (invite consumed).
--   Otherwise: allowed_domain -> pending; anything else -> denied.
--   E-mail comparison is case-insensitive. When an unconfirmed user later confirms, the
--   active branches are re-evaluated (never downgrades an existing member).
-- =====================================================================================

-- Internal: decide role/status for an e-mail. Does not consume the invite.
create function public._signup_status(p_email text, p_confirmed boolean, out role text, out status text, out invited boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_domain text := case when v_email ~ '^[^@\s]+@[^@\s]+$' then split_part(v_email, '@', 2) end;
  s public.app_settings;
  v_invite public.invites;
begin
  select * into s from public.app_settings where id = 1;
  select * into v_invite from public.invites where email = v_email;
  invited := false;
  if v_domain is not null and p_confirmed and s.bootstrap_admin_email is not null
     and v_email = lower(trim(s.bootstrap_admin_email)) then
    role := 'admin'; status := 'active';
  elsif v_domain is not null and p_confirmed and v_invite.email is not null then
    role := v_invite.role; status := 'active'; invited := true;
  elsif v_domain is not null and s.allowed_domain is not null
        and v_domain = lower(trim(s.allowed_domain)) then
    role := null; status := 'pending';
  else
    role := null; status := 'denied';
  end if;
end $$;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(new.email, '')));
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  r record;
begin
  r := public._signup_status(v_email, new.email_confirmed_at is not null);
  if r.invited then
    delete from public.invites where email = v_email;
  end if;
  insert into public.members (id, email, name, avatar_url, role, status)
  values (
    new.id,
    v_email,
    coalesce(nullif(v_meta ->> 'full_name', ''), nullif(v_meta ->> 'name', ''), split_part(v_email, '@', 1)),
    nullif(v_meta ->> 'avatar_url', ''),
    r.role,
    r.status
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- E-mail confirmed after signup: grant the bootstrap/invite outcome to a non-active member.
create function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(new.email, '')));
  r record;
begin
  r := public._signup_status(v_email, true);
  if r.status = 'active' then
    update public.members set role = r.role, status = 'active'
      where id = new.id and status <> 'active' and not status_locked;
    if found and r.invited then
      delete from public.invites where email = v_email;
    end if;
  end if;
  return new;
end $$;

create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_confirmed();

-- Any role/status change not made by the signup triggers (an admin through the API, or SQL
-- by hand) locks the member, so a later e-mail confirmation cannot override that decision.
-- pg_trigger_depth() > 1 means the update comes from inside another trigger
-- (handle_user_confirmed on auth.users); clients cannot reach that depth.
create function public.lock_member_status() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and pg_trigger_depth() <= 1 then
    new.status_locked := true;
  end if;
  return new;
end $$;
create trigger members_lock_status before update on public.members
  for each row execute function public.lock_member_status();

-- Stamp who wrote admin-managed rows (not spoofable by the client).
create function public.stamp_invited_by() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.email := lower(trim(new.email));
  new.invited_by := auth.uid();
  return new;
end $$;
create trigger invites_stamp before insert or update on public.invites
  for each row execute function public.stamp_invited_by();

create function public.stamp_template_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger templates_stamp before insert or update on public.templates
  for each row execute function public.stamp_template_author();

-- =====================================================================================
-- Row-level security
-- =====================================================================================

alter table public.app_settings enable row level security;
alter table public.members      enable row level security;
alter table public.invites      enable row level security;
alter table public.mandate      enable row level security;
alter table public.templates    enable row level security;
alter table public.deals        enable row level security;
alter table public.activity     enable row level security;

-- Readable by every active member with a role.
create policy deals_read on public.deals for select to authenticated
  using (public.has_role(array['admin', 'associate', 'analyst', 'reader']));
create policy activity_read on public.activity for select to authenticated
  using (public.has_role(array['admin', 'associate', 'analyst', 'reader']));
create policy members_read on public.members for select to authenticated
  using (public.has_role(array['admin', 'associate', 'analyst', 'reader']));
create policy mandate_read on public.mandate for select to authenticated
  using (public.has_role(array['admin', 'associate', 'analyst', 'reader']));
create policy templates_read on public.templates for select to authenticated
  using (public.has_role(array['admin', 'associate', 'analyst', 'reader']));

-- Admin only.
create policy members_admin_update on public.members for update to authenticated
  using (public.has_role(array['admin'])) with check (public.has_role(array['admin']));
create policy invites_admin on public.invites for all to authenticated
  using (public.has_role(array['admin'])) with check (public.has_role(array['admin']));
create policy mandate_admin on public.mandate for all to authenticated
  using (public.has_role(array['admin'])) with check (public.has_role(array['admin']));
create policy templates_admin on public.templates for all to authenticated
  using (public.has_role(array['admin'])) with check (public.has_role(array['admin']));
create policy app_settings_admin on public.app_settings for all to authenticated
  using (public.has_role(array['admin'])) with check (public.has_role(array['admin']));

-- =====================================================================================
-- Privileges (Supabase grants everything to anon/authenticated by default; narrow it).
-- TRUNCATE bypasses RLS, so it is revoked everywhere.
-- =====================================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.deals, public.activity, public.members to authenticated;
grant select, insert, update, delete on public.invites, public.mandate, public.templates, public.app_settings
  to authenticated;
grant update (role, status) on public.members to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;

-- Objects created later by this role are not auto-granted to clients either.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
-- The built-in PUBLIC EXECUTE default can only be revoked globally (not per schema).
-- WARNING: from here on, EVERY function created later by this role (postgres on Supabase),
-- in ANY schema, including functions created by extensions installed by postgres, is NOT
-- executable by clients until an explicit
--   grant execute on function <schema>.<fn>(<args>) to authenticated;
-- is added in the migration that creates it.
alter default privileges revoke execute on functions from public;
grant execute on function
  public.current_member(),
  public.has_role(text[]),
  public.create_deal(jsonb),
  public.import_deal(jsonb, jsonb),
  public.patch_deal(uuid, text[], jsonb),
  public.set_phase(uuid, text),
  public.validate_bote(uuid),
  public.decide(uuid, text),
  public.set_archived(uuid, boolean),
  public.delete_deal(uuid),
  public.set_committee_date(uuid, date),
  public.set_contributors(uuid, uuid[]),
  public.set_owner(uuid, uuid),
  public.set_my_locale(text)
to authenticated;

-- =====================================================================================
-- Realtime (the publication only exists on Supabase, not in the local test database).
-- =====================================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.deals, public.activity;
  end if;
end $$;
