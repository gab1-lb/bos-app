-- RLS / permission / signup tests. Run by scripts/test-sql.sh (psql, ON_ERROR_STOP=1).
-- Every assertion raises 'FAIL: ...' on failure, which aborts the run with a non-zero exit.
-- Users are simulated with `set role authenticated` + `set test.uid` so RLS really applies.
\o /dev/null
set client_min_messages = notice;

-- ---------------------------------------------------------------- helpers (as owner)
create schema test;
grant usage on schema test to anon, authenticated;

create function test.ok(p_cond boolean, p_label text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'FAIL: %', p_label; end if;
  raise notice 'ok: %', p_label;
end $$;

create function test.throws(p_sql text, p_state text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_state then raise notice 'ok: % (%)', p_label, sqlstate; return; end if;
    raise exception 'FAIL: % (expected %, got %: %)', p_label, p_state, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: % (no error raised)', p_label;
end $$;

create function test.as_user(p_uid uuid) returns void language sql as $$
  select set_config('test.uid', coalesce(p_uid::text, ''), false);
$$;
grant execute on all functions in schema test to anon, authenticated;

-- ---------------------------------------------------------------- signup
insert into public.app_settings (allowed_domain, bootstrap_admin_email)
  values ('bos.example', 'boss@bos.example');
insert into public.invites (email, role) values ('guest@partner.example', 'associate');

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'Boss@BOS.example', '{"full_name":"The Boss","avatar_url":"https://img/boss.png"}', now()),
  ('00000000-0000-0000-0000-0000000000a2', 'guest@partner.example', '{"full_name":"Guest"}', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'ana1@bos.example', '{"full_name":"Ana One"}', now()),
  ('00000000-0000-0000-0000-0000000000b2', 'ana2@bos.example', '{}', now()),
  ('00000000-0000-0000-0000-0000000000c1', 'asso1@bos.example', '{}', now()),
  ('00000000-0000-0000-0000-0000000000c2', 'asso2@bos.example', '{}', now()),
  ('00000000-0000-0000-0000-0000000000d1', 'reader@bos.example', '{}', now()),
  ('00000000-0000-0000-0000-0000000000e1', 'pending@bos.example', '{}', now()),
  ('00000000-0000-0000-0000-0000000000f1', 'out@evil.example', '{}', now()),
  ('00000000-0000-0000-0000-0000000000f2', 'x@bos.example.evil.example', '{}', now()),
  ('00000000-0000-0000-0000-0000000000f3', 'x@evil.example@bos.example', '{}', now());

select test.ok((select status = 'active' and role = 'admin' and name = 'The Boss' and avatar_url = 'https://img/boss.png'
                from public.members where id = '00000000-0000-0000-0000-0000000000a1'),
               'signup: bootstrap e-mail (case-insensitive) -> admin active, name/avatar from metadata');
select test.ok((select status = 'active' and role = 'associate' from public.members where id = '00000000-0000-0000-0000-0000000000a2'),
               'signup: invited e-mail -> active with invite role');
select test.ok(not exists (select 1 from public.invites where email = 'guest@partner.example'),
               'signup: invite consumed');
select test.ok((select status = 'pending' and role is null from public.members where id = '00000000-0000-0000-0000-0000000000e1'),
               'signup: allowed-domain e-mail -> pending, no role');
select test.ok((select status = 'denied' and role is null from public.members where id = '00000000-0000-0000-0000-0000000000f1'),
               'signup: out-of-domain e-mail -> denied');
select test.ok((select status = 'denied' from public.members where id = '00000000-0000-0000-0000-0000000000f2'),
               'signup: look-alike domain suffix -> denied');
select test.ok((select status = 'denied' from public.members where id = '00000000-0000-0000-0000-0000000000f3'),
               'signup: malformed e-mail with two @ -> denied');
select test.ok((select locale = 'fr' from public.members where id = '00000000-0000-0000-0000-0000000000b1'),
               'signup: default locale fr');

-- unconfirmed e-mails never get an active branch
insert into public.invites (email, role) values ('late@partner.example', 'analyst');
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000f4', 'boss@bos.example', '{}', null),
  ('00000000-0000-0000-0000-0000000000f5', 'late@partner.example', '{}', null);
select test.ok((select status = 'pending' and role is null from public.members where id = '00000000-0000-0000-0000-0000000000f4'),
               'signup: unconfirmed bootstrap e-mail -> pending (domain matches), not admin');
select test.ok((select status = 'denied' and role is null from public.members where id = '00000000-0000-0000-0000-0000000000f5'),
               'signup: unconfirmed invited e-mail outside domain -> denied');
select test.ok(exists (select 1 from public.invites where email = 'late@partner.example'),
               'signup: invite not consumed while unconfirmed');
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000f5';
select test.ok((select status = 'active' and role = 'analyst' from public.members where id = '00000000-0000-0000-0000-0000000000f5'),
               'signup: invited e-mail activated once confirmed');
select test.ok(not exists (select 1 from public.invites where email = 'late@partner.example'),
               'signup: invite consumed on confirmation');
update auth.users set email_confirmed_at = null where id = '00000000-0000-0000-0000-0000000000f4';
update auth.users set raw_user_meta_data = '{"x":1}' where id = '00000000-0000-0000-0000-0000000000f4';
select test.ok((select status = 'pending' from public.members where id = '00000000-0000-0000-0000-0000000000f4'),
               'signup: unrelated auth.users update changes nothing');

-- future objects are not auto-granted to clients
create table public.zz_probe (id int);
create function public.zz_probe_fn() returns int language sql as 'select 1';
select test.ok(not has_table_privilege('authenticated', 'public.zz_probe', 'select')
               and not has_table_privilege('anon', 'public.zz_probe', 'select'),
               'default privileges: new tables not granted to anon/authenticated');
select test.ok(not has_function_privilege('anon', 'public.zz_probe_fn()', 'execute')
               and not has_function_privilege('authenticated', 'public.zz_probe_fn()', 'execute'),
               'default privileges: new functions not executable by anon/authenticated');
drop function public.zz_probe_fn();
drop table public.zz_probe;
select test.ok(not exists (select 1 from pg_proc where proname = '_touch'), 'unused _touch removed');

-- ---------------------------------------------------------------- admin approves members
set role authenticated;
select test.as_user('00000000-0000-0000-0000-0000000000a1');
update public.members set status = 'active', role = 'analyst'
  where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2');
update public.members set status = 'active', role = 'associate'
  where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2');
update public.members set status = 'active', role = 'reader' where id = '00000000-0000-0000-0000-0000000000d1';
select test.ok((select count(*) = 6 from public.members where role in ('analyst', 'associate') and status = 'active'),
               'admin: can approve members');
insert into public.invites (email, role) values ('next@partner.example', 'analyst');
insert into public.mandate (data) values ('{"ebitdaMin":2}');
update public.mandate set data = '{"ebitdaMin":3}';
insert into public.templates (key, locale, subject, body) values ('info_request', 'fr', 'S', 'B');
select test.ok((select count(*) = 1 from public.invites), 'admin: can write invites');
select test.ok((select data->>'ebitdaMin' = '3' from public.mandate), 'admin: can write mandate');

-- an admin decision is not overridden by a later e-mail confirmation
reset role;
insert into public.invites (email, role) values ('newbie@bos.example', 'analyst');
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000f6', 'newbie@bos.example', '{}', null);
select test.ok((select status = 'pending' and not status_locked from public.members where id = '00000000-0000-0000-0000-0000000000f6'),
               'signup: unconfirmed in-domain invitee -> pending, unlocked');
set role authenticated;
select test.as_user('00000000-0000-0000-0000-0000000000a1');
update public.members set status = 'denied' where id = '00000000-0000-0000-0000-0000000000f6';
select test.throws($$update public.members set status_locked = false where id = '00000000-0000-0000-0000-0000000000f6'$$, '42501',
                   'admin: status_locked not directly writable');
reset role;
select test.ok((select status = 'denied' and status_locked from public.members where id = '00000000-0000-0000-0000-0000000000f6'),
               'admin status change locks the member');
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000f6';
select test.ok((select status = 'denied' and role is null from public.members where id = '00000000-0000-0000-0000-0000000000f6'),
               'confirmation does not override an admin denial (locked member stays denied)');
set role authenticated;
select test.as_user('00000000-0000-0000-0000-0000000000a1');

-- ---------------------------------------------------------------- analyst ana1 creates deals
select test.as_user('00000000-0000-0000-0000-0000000000b1');
select public.create_deal('{"name":"Alpha","kpi":{}}') as d1 \gset
select public.create_deal('{"name":"Bravo","kpi":{}}') as d2 \gset
select test.ok((select owner_id = '00000000-0000-0000-0000-0000000000b1' and phase = 'im_received'
                and phase_entered_at is not null and not archived and data->>'id' = id::text
                and updated_by = '00000000-0000-0000-0000-0000000000b1'
                from public.deals where id = :'d1'),
               'create_deal: owner = caller, phase im_received, data.id = row id');
select test.ok((select count(*) = 1 from public.activity where deal_id = :'d1' and kind = 'create'),
               'create_deal: activity logged');
select test.throws($$select public.create_deal('[1,2]')$$, '22023', 'create_deal: non-object data rejected');

-- ---------------------------------------------------------------- pending / denied / anon see nothing
select test.as_user('00000000-0000-0000-0000-0000000000e1');
select test.ok((select count(*) = 0 from public.deals), 'pending: select count(*) from deals = 0');
select test.ok((select count(*) = 0 from public.activity), 'pending: no activity visible');
select test.ok((select count(*) = 1 and bool_and(status = 'pending') from public.members), 'pending: sees only own member row (status pending)');
select test.ok((select count(*) = 0 from public.members where id <> '00000000-0000-0000-0000-0000000000e1'), 'pending: no other members visible');
select test.ok((select count(*) = 0 from public.mandate), 'pending: no mandate visible');
select test.ok((select count(*) = 0 from public.templates), 'pending: no templates visible');
select test.ok((select status = 'pending' from public.current_member()), 'pending: current_member() returns own row');
select test.ok(not public.has_role(array['admin','associate','analyst','reader']), 'pending: has_role false');
select test.throws($$select public.create_deal('{"name":"x"}')$$, '42501', 'pending: create_deal refused');
select test.throws(format('select public.patch_deal(%L, %L, %L)', :'d1', '{name}', '"x"'), '42501', 'pending: patch_deal refused');
select test.throws($$select public.set_my_locale('en')$$, '42501', 'pending: set_my_locale refused');
select test.throws(format('select public.deal_list_append(%L, %L, %L)', :'d1', 'questions', '{"id":"p"}'), '42501', 'pending: deal_list_append refused');

select test.as_user('00000000-0000-0000-0000-0000000000f1');
select test.ok((select count(*) = 0 from public.deals), 'denied: no deals visible');
select test.throws(format('select public.patch_deal(%L, %L, %L)', :'d1', '{name}', '"x"'), '42501', 'denied: patch_deal refused');

select test.as_user(null);
select test.ok((select count(*) = 0 from public.deals), 'authenticated without uid: no deals visible');
reset role;
set role anon;
select test.throws($$select count(*) from public.deals$$, '42501', 'anon: deals not readable at all');
select test.throws($$select count(*) from public.members$$, '42501', 'anon: members not readable at all');
select test.throws($$select public.create_deal('{"name":"x"}')$$, '42501', 'anon: create_deal not executable');
reset role;

-- ---------------------------------------------------------------- reader
set role authenticated;
select test.as_user('00000000-0000-0000-0000-0000000000d1');
select test.ok((select count(*) = 2 from public.deals), 'reader: sees deals');
select test.ok((select count(*) >= 2 from public.activity), 'reader: sees activity');
select test.ok((select count(*) = 1 from public.mandate), 'reader: sees mandate');
select test.ok((select count(*) >= 8 from public.members), 'reader: sees members');
select test.throws(format('select public.patch_deal(%L, %L, %L)', :'d1', '{name}', '"x"'), '42501', 'reader: patch_deal refused');
select test.throws($$select public.create_deal('{"name":"x"}')$$, '42501', 'reader: create_deal refused');
select test.throws(format('select public.set_phase(%L, %L)', :'d1', 'analysis'), '42501', 'reader: set_phase refused');
select test.throws(format('select public.set_committee_date(%L, %L)', :'d1', '2026-12-01'), '42501', 'reader: set_committee_date refused');
select test.throws(format('select public.deal_list_append(%L, %L, %L)', :'d1', 'questions', '{"id":"r"}'), '42501', 'reader: deal_list_append refused');
select test.throws(format('select public.deal_list_remove(%L, %L, %L)', :'d1', 'questions', 'r'), '42501', 'reader: deal_list_remove refused');
select test.throws(format('select public.deal_list_update(%L, %L, %L, %L)', :'d1', 'questions', 'r', '{"q":"x"}'), '42501', 'reader: deal_list_update refused');
select public.set_my_locale('en');
select test.ok((select locale = 'en' from public.current_member()), 'reader: set_my_locale(en) ok');
select test.throws($$select public.set_my_locale('de')$$, '22023', 'set_my_locale: unknown locale rejected');

-- ---------------------------------------------------------------- analyst ana2 on ana1's deal
select test.as_user('00000000-0000-0000-0000-0000000000b2');
select public.patch_deal(:'d1', '{kpi,churn}', '5');
select public.patch_deal(:'d1', '{kpi,top10}', '40');
select test.ok((select data->'kpi' = '{"churn":5,"top10":40}'::jsonb from public.deals where id = :'d1'),
               'patch_deal: two successive patches on {kpi,churn} and {kpi,top10} both present');
select test.ok((select updated_by = '00000000-0000-0000-0000-0000000000b2' and updated_at is not null
                from public.deals where id = :'d1'), 'patch_deal: updated_by/updated_at set');
select test.ok((select count(*) = 1 from public.activity where deal_id = :'d1' and kind = 'patch'
                and path = 'kpi.churn' and old_value is null and new_value = '5'::jsonb
                and actor_id = '00000000-0000-0000-0000-0000000000b2'),
               'patch_deal: activity row with path, old and new value');
select public.patch_deal(:'d1', '{kpi,churn}', '6');
select test.ok((select count(*) = 1 from public.activity where deal_id = :'d1' and kind = 'patch'
                and path = 'kpi.churn' and old_value = '5'::jsonb and new_value = '6'::jsonb),
               'patch_deal: old_value captured');
select test.ok((select data->>'id' = id::text from public.deals where id = :'d1'), 'patch_deal: data.id unchanged');
select test.throws(format('select public.patch_deal(%L, %L, %L)', :'d1', '{id}', '"other"'), '22023', 'patch_deal: data.id is immutable');
select test.throws(format('select public.patch_deal(%L, %L, %L)', :'d1', '{}', '{}'), '22023', 'patch_deal: empty path rejected');

select test.throws(format('select public.validate_bote(%L)', :'d1'), '42501', 'analyst: validate_bote refused');
select test.throws(format('select public.set_phase(%L, %L)', :'d1', 'associate_review'), '42501', 'analyst: set_phase associate_review refused');
select test.throws(format('select public.set_phase(%L, %L)', :'d1', 'committee'), '42501', 'analyst: set_phase committee refused');
select test.throws(format('select public.decide(%L, %L)', :'d1', 'go_dd'), '42501', 'analyst: decide refused');
select test.throws(format('select public.delete_deal(%L)', :'d1'), '42501', 'analyst: delete_deal refused');
select test.throws(format('select public.set_archived(%L, true)', :'d1'), '42501', 'analyst: archive of a deal owned by someone else refused');
select test.throws(format('select public.set_owner(%L, %L)', :'d1', '00000000-0000-0000-0000-0000000000b2'), '42501', 'analyst: set_owner refused');
select test.throws($$select public.import_deal('{"name":"I"}', '{}')$$, '42501', 'analyst: import_deal refused');
select public.set_phase(:'d1', 'analysis');
select public.set_phase(:'d1', 'bote_written');
select test.ok((select phase = 'bote_written' from public.deals where id = :'d1'), 'analyst: set_phase to analyst phases ok');
select test.ok((select count(*) = 2 from public.activity where deal_id = :'d1' and kind = 'phase'), 'set_phase: activity logged');
select test.throws(format('select public.set_phase(%L, %L)', :'d1', 'nonsense'), '22023', 'set_phase: unknown phase rejected');
select public.set_committee_date(:'d1', '2026-12-15');
select test.ok((select committee_date = '2026-12-15' from public.deals where id = :'d1'), 'analyst: set_committee_date ok');
select public.set_contributors(:'d1', array['00000000-0000-0000-0000-0000000000b2']::uuid[]);
select test.ok((select contributor_ids = array['00000000-0000-0000-0000-0000000000b2']::uuid[] from public.deals where id = :'d1'),
               'analyst: set_contributors ok');
select test.throws(format('select public.set_contributors(%L, %L)', :'d1', '{00000000-0000-0000-0000-00000000ffff}'), '22023',
                   'set_contributors: unknown member rejected');

-- list items by id (questions / adjustments / comps): no lost update, no write to the wrong row
select public.deal_list_append(:'d1', 'questions', '{"id":"qa","q":"A","answer":""}');
select public.deal_list_append(:'d1', 'questions', '{"id":"qb","q":"B","answer":""}');
select public.deal_list_append(:'d1', 'questions', '{"id":"qc","q":"C","answer":""}');
select test.ok((select jsonb_array_length(data->'questions') = 3 and data->'questions'->2->>'id' = 'qc' from public.deals where id = :'d1'),
               'deal_list_append: creates the list and appends in order');
select test.ok((select count(*) = 3 from public.activity where deal_id = :'d1' and kind = 'list_add' and path = 'questions'
                and actor_id = '00000000-0000-0000-0000-0000000000b2'), 'deal_list_append: one activity row per item');
-- B answers question C by id, then A deletes question A (positions shift): C keeps its answer, B is untouched
select public.deal_list_update(:'d1', 'questions', 'qc', '{"answer":"yes"}');
select public.deal_list_remove(:'d1', 'questions', 'qa');
select test.ok((select data->'questions' = '[{"id":"qb","q":"B","answer":""},{"id":"qc","q":"C","answer":"yes"}]'::jsonb
                from public.deals where id = :'d1'), 'deal_list_remove: removes by id, other rows and their edits kept');
-- a later edit by id still reaches question C at its new position
select public.deal_list_update(:'d1', 'questions', 'qc', '{"answer":"later","sentAt":"2026-11-01","status":"Envoyée"}');
select test.ok((select data->'questions'->1 = '{"id":"qc","q":"C","answer":"later","sentAt":"2026-11-01","status":"Envoyée"}'::jsonb
                and data->'questions'->0 = '{"id":"qb","q":"B","answer":""}'::jsonb
                from public.deals where id = :'d1'), 'deal_list_update: by id after a removal, several fields at once');
select test.ok((select count(*) = 1 from public.activity where deal_id = :'d1' and kind = 'patch' and path = 'questions.1.answer'
                and old_value = '"yes"'::jsonb and new_value = '"later"'::jsonb), 'deal_list_update: activity per field with old and new value');
select test.ok((select count(*) = 3 from public.activity where deal_id = :'d1' and kind = 'patch' and path like 'questions.1.%'
                and new_value <> '"yes"'::jsonb), 'deal_list_update: one row per changed field');
select public.deal_list_update(:'d1', 'questions', 'qc', '{"answer":"later"}');
select test.ok((select count(*) = 1 from public.activity where deal_id = :'d1' and path = 'questions.1.answer' and new_value = '"later"'::jsonb),
               'deal_list_update: unchanged value not logged again');
select test.ok((select count(*) = 1 from public.activity where deal_id = :'d1' and kind = 'list_remove' and path = 'questions'
                and old_value->>'id' = 'qa' and new_value is null), 'deal_list_remove: activity row keeps the removed item');
select public.deal_list_remove(:'d1', 'questions', 'qa');
select test.ok((select count(*) = 1 from public.activity where deal_id = :'d1' and kind = 'list_remove'),
               'deal_list_remove: an item already removed is a no-op');
select test.throws(format('select public.deal_list_update(%L, %L, %L, %L)', :'d1', 'questions', 'qa', '{"answer":"x"}'), 'P0002',
                   'deal_list_update: removed item -> not found (never another row)');
select test.throws(format('select public.deal_list_append(%L, %L, %L)', :'d1', 'questions', '{"id":"qb","q":"dup"}'), '22023',
                   'deal_list_append: duplicate id rejected');
select test.throws(format('select public.deal_list_append(%L, %L, %L)', :'d1', 'questions', '{"q":"no id"}'), '22023',
                   'deal_list_append: item without id rejected');
select test.throws(format('select public.deal_list_append(%L, %L, %L)', :'d1', 'questions', '[1]'), '22023',
                   'deal_list_append: non-object item rejected');
select test.throws(format('select public.deal_list_update(%L, %L, %L, %L)', :'d1', 'questions', 'qb', '{"id":"zz"}'), '22023',
                   'deal_list_update: id is immutable');
select test.throws(format('select public.deal_list_update(%L, %L, %L, %L)', :'d1', 'questions', 'qb', '{}'), '22023',
                   'deal_list_update: empty fields rejected');
select test.throws(format('select public.deal_list_append(%L, %L, %L)', :'d1', 'name', '{"id":"x"}'), '22023',
                   'deal_list_append: unknown list rejected');
select test.throws(format('select public.deal_list_append(%L, %L, %L)', '00000000-0000-0000-0000-00000000dead', 'questions', '{"id":"x"}'), 'P0002',
                   'deal_list_append: unknown deal -> not found');
select public.deal_list_append(:'d1', 'adjustments', '{"id":"a1","label":"L","amount":1}');
select public.deal_list_append(:'d1', 'comps', '{"id":"c1","target":"T","include":true}');
select public.deal_list_update(:'d1', 'comps', 'c1', '{"include":false}');
select test.ok((select data->'adjustments'->0->>'id' = 'a1' and data->'comps'->0->>'include' = 'false'
                from public.deals where id = :'d1'), 'adjustments and comps: append and update by id');
select public.patch_deal(:'d2', '{questions}', '"oops"');
select test.throws(format('select public.deal_list_append(%L, %L, %L)', :'d2', 'questions', '{"id":"x"}'), '22023',
                   'deal_list_append: a list that is not an array is rejected');
select public.patch_deal(:'d2', '{questions}', '[]');

-- direct writes are refused
select test.throws($$insert into public.deals (data) values ('{"name":"Direct"}')$$, '42501', 'analyst: direct insert into deals refused');
select test.throws(format('update public.deals set phase = %L where id = %L', 'decided', :'d1'), '42501', 'analyst: direct update of deals refused');
select test.throws(format('delete from public.deals where id = %L', :'d1'), '42501', 'analyst: direct delete from deals refused');
select test.throws(format('insert into public.activity (deal_id, kind) values (%L, %L)', :'d1', 'patch'), '42501', 'analyst: direct insert into activity refused');
update public.members set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b2';
select test.ok((select role = 'analyst' from public.current_member()), 'analyst: update of members has no effect (RLS)');
select test.throws($$update public.members set name = 'x' where id = '00000000-0000-0000-0000-0000000000b2'$$, '42501', 'analyst: members.name not updatable');
select test.throws($$insert into public.invites (email, role) values ('a@b.c', 'admin')$$, '42501', 'analyst: cannot write invites');
update public.mandate set data = '{}';
select test.ok((select data->>'ebitdaMin' = '3' from public.mandate), 'analyst: update of mandate has no effect (RLS)');
select test.throws($$insert into public.templates (key, locale, subject, body) values ('k', 'fr', 's', 'b')$$, '42501', 'analyst: cannot write templates');
select test.ok((select count(*) = 0 from public.app_settings), 'analyst: app_settings not visible');

-- analyst archives own deal
select test.as_user('00000000-0000-0000-0000-0000000000b1');
select public.set_archived(:'d2', true);
select test.ok((select archived from public.deals where id = :'d2'), 'analyst: archive own deal ok');
select test.ok((select count(*) = 1 from public.activity where deal_id = :'d2' and kind = 'archive'), 'set_archived: activity logged');
select public.set_archived(:'d2', false);

-- ---------------------------------------------------------------- associates
select test.as_user('00000000-0000-0000-0000-0000000000c1');
select public.create_deal('{"name":"Charlie","kpi":{}}') as d3 \gset
select test.throws(format('select public.validate_bote(%L)', :'d3'), '22023', 'validate_bote: refused outside associate_review');
select public.set_phase(:'d3', 'associate_review');
select test.throws(format('select public.validate_bote(%L)', :'d3'), '42501', 'associate owner: validate_bote refused');
select test.as_user('00000000-0000-0000-0000-0000000000c2');
select public.validate_bote(:'d3');
select test.ok((select validated_by = '00000000-0000-0000-0000-0000000000c2' and validated_at is not null
                from public.deals where id = :'d3'), 'other associate: validate_bote ok, validated_* set');
select test.ok((select count(*) = 1 from public.activity where deal_id = :'d3' and kind = 'validate'), 'validate_bote: activity logged');
select test.as_user('00000000-0000-0000-0000-0000000000b1');
select test.throws(format('select public.set_phase(%L, %L)', :'d3', 'analysis'), '42501', 'analyst: set_phase out of associate_review refused');
select test.ok((select phase = 'associate_review' and validated_by = '00000000-0000-0000-0000-0000000000c2' and validated_at is not null
                from public.deals where id = :'d3'), 'analyst: validated_* unchanged after refused set_phase');
select test.as_user('00000000-0000-0000-0000-0000000000c2');
select public.set_phase(:'d3', 'committee');
select test.ok((select validated_by is not null from public.deals where id = :'d3'), 'set_phase forward to committee keeps validation');
select public.set_phase(:'d3', 'associate_review');
select public.set_phase(:'d3', 'analysis');
select test.ok((select validated_by is null and validated_at is null and phase = 'analysis'
                from public.deals where id = :'d3'), 'set_phase back before associate_review clears validated_*');
select test.throws(format('select public.set_phase(%L, %L)', :'d3', 'decided'), '22023', 'set_phase: decided only via decide()');
select test.throws(format('select public.decide(%L, %L)', :'d3', 'maybe'), '22023', 'decide: unknown decision rejected');
select public.decide(:'d3', 'go_dd');
select test.ok((select phase = 'decided' and decision = 'go_dd' and decided_at is not null from public.deals where id = :'d3'),
               'associate: decide sets phase/decision/decided_at');
select test.ok((select count(*) = 1 from public.activity where deal_id = :'d3' and kind = 'decide'), 'decide: activity logged');
select test.as_user('00000000-0000-0000-0000-0000000000b1');
select test.throws(format('select public.set_phase(%L, %L)', :'d3', 'analysis'), '42501', 'analyst: set_phase on a decided deal refused');
select test.ok((select phase = 'decided' and decision = 'go_dd' and decided_at is not null from public.deals where id = :'d3'),
               'analyst: decision/decided_at unchanged after refused set_phase');
select test.as_user('00000000-0000-0000-0000-0000000000c2');
select public.set_phase(:'d3', 'committee');
select test.ok((select decision is null and decided_at is null from public.deals where id = :'d3'), 'set_phase out of decided clears decision');
select public.set_archived(:'d1', true);
select test.ok((select archived from public.deals where id = :'d1'), 'associate: can archive any deal');
select public.set_archived(:'d1', false);
select public.set_owner(:'d1', '00000000-0000-0000-0000-0000000000b2');
select test.ok((select owner_id = '00000000-0000-0000-0000-0000000000b2' from public.deals where id = :'d1'), 'associate: set_owner ok');
select test.throws(format('select public.set_owner(%L, %L)', :'d1', '00000000-0000-0000-0000-0000000000d1'), '22023',
                   'set_owner: reader cannot own a deal');
select test.throws($$insert into public.invites (email, role) values ('a@b.c', 'analyst')$$, '42501', 'associate: cannot write invites');
update public.members set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c2';
select test.ok((select role = 'associate' from public.current_member()), 'associate: update of own member row has no effect (RLS)');

select public.import_deal('{"name":"Imported","id":"legacy-1"}',
  '{"phase":"decided","decision":"no_go","decidedAt":"2025-01-02T00:00:00Z","phaseEnteredAt":"2025-01-02T00:00:00Z","ownerId":"00000000-0000-0000-0000-0000000000b1"}') as d4 \gset
select test.ok((select phase = 'decided' and decision = 'no_go' and decided_at = '2025-01-02T00:00:00Z'
                and owner_id = '00000000-0000-0000-0000-0000000000c2' and data->>'id' = id::text
                from public.deals where id = :'d4'), 'associate: import_deal keeps phase/decision, owner = importer');
select test.ok((select count(*) = 1 from public.activity where deal_id = :'d4' and kind = 'import'), 'import_deal: activity logged');
select test.throws($$select public.import_deal('{"name":"I"}', '{"phase":"bogus"}')$$, '22023', 'import_deal: bad phase rejected');

select public.delete_deal(:'d4');
select test.ok(not exists (select 1 from public.deals where id = :'d4'), 'associate: delete_deal ok');
select test.ok((select count(*) = 1 from public.activity where kind = 'delete' and old_value->>'id' = :'d4'),
               'delete_deal: activity logged');

-- ---------------------------------------------------------------- admin: same senior rules
select test.as_user('00000000-0000-0000-0000-0000000000a1');
select public.create_deal('{"name":"Delta"}') as d5 \gset
select public.set_phase(:'d5', 'associate_review');
select test.throws(format('select public.validate_bote(%L)', :'d5'), '42501', 'admin owner: validate_bote refused');
select test.throws(format('select public.set_owner(%L, %L)', :'d5', '00000000-0000-0000-0000-0000000000c1'), '42501',
                   'set_owner refused while deal is in associate_review');
select test.ok((select owner_id = '00000000-0000-0000-0000-0000000000a1' from public.deals where id = :'d5'), 'set_owner: owner unchanged');
select test.as_user('00000000-0000-0000-0000-0000000000c2');
select public.validate_bote(:'d5');
select public.set_phase(:'d5', 'committee');
select test.as_user('00000000-0000-0000-0000-0000000000a1');
select public.set_owner(:'d5', '00000000-0000-0000-0000-0000000000c1');
select test.ok((select owner_id = '00000000-0000-0000-0000-0000000000c1' and validated_by is null and validated_at is null
                from public.deals where id = :'d5'), 'set_owner clears validated_*');
select test.ok((select count(*) = 1 from public.app_settings), 'admin: app_settings visible');
select test.throws(format('select public.patch_deal(%L, %L, %L)', '00000000-0000-0000-0000-00000000dead', '{name}', '"x"'), 'P0002',
                   'patch_deal: unknown deal -> not found');
reset role;

-- ---------------------------------------------------------------- last active admin is kept
-- a1 is the only active admin at this point; acting as a1 through RLS.
set role authenticated;
select test.as_user('00000000-0000-0000-0000-0000000000a1');
select test.ok((select count(*) = 1 from public.members where role = 'admin' and status = 'active'), 'one active admin before the checks');
select test.throws($$update public.members set role = 'associate' where id = '00000000-0000-0000-0000-0000000000a1'$$, '42501',
                   'last admin: cannot demote oneself');
select test.throws($$update public.members set status = 'denied' where id = '00000000-0000-0000-0000-0000000000a1'$$, '42501',
                   'last admin: cannot deny oneself');
select test.throws($$update public.members set status = 'pending', role = null where id = '00000000-0000-0000-0000-0000000000a1'$$, '42501',
                   'last admin: cannot reset oneself to pending');
-- a second admin makes the demotion possible
update public.members set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c1';
update public.members set role = 'associate' where id = '00000000-0000-0000-0000-0000000000a1';
select test.ok((select role = 'associate' from public.members where id = '00000000-0000-0000-0000-0000000000a1'),
               'admin demotion allowed while another active admin remains');
select test.as_user('00000000-0000-0000-0000-0000000000c1');
select test.throws($$update public.members set role = 'analyst' where id = '00000000-0000-0000-0000-0000000000c1'$$, '42501',
                   'new last admin: cannot demote oneself');
-- a non-admin change on the last admin row (locale) is unaffected
select public.set_my_locale('en');
select test.ok((select locale = 'en' from public.members where id = '00000000-0000-0000-0000-0000000000c1'), 'last admin: locale change still allowed');
reset role;
select test.throws($$update public.members set status = 'denied' where id = '00000000-0000-0000-0000-0000000000c1'$$, '42501',
                   'last admin: refused even for the table owner');
-- restore (as the owner)
update public.members set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1';
select test.ok((select count(*) = 2 from public.members where role = 'admin' and status = 'active'), 'two active admins after restore');

\o
\echo 'rls.test.sql: all assertions passed'
