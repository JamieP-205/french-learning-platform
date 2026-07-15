-- Public deployment RLS checklist.
--
-- Usage after applying every migration and seed:
--   1. Create two confirmed Supabase Auth users.
--   2. Complete onboarding for both so each has a public.profiles row.
--   3. Run:
--      psql "$DATABASE_URL" \
--        -v learner_a_id='00000000-0000-0000-0000-000000000001' \
--        -v learner_b_id='00000000-0000-0000-0000-000000000002' \
--        -f supabase/tests/rls-checklist.sql
--
-- Expected result: the final select returns only ok=true rows. The script rolls
-- back all writes, including denied-write probes that intentionally raise errors.

\set ON_ERROR_STOP on

begin;

create temp table rls_check_results (
  check_name text primary key,
  ok boolean not null,
  detail text
) on commit drop;

grant select, insert on rls_check_results to authenticated;

create or replace function pg_temp.record_check(check_name text, ok boolean, detail text default null)
returns void
language plpgsql
as $$
begin
  insert into rls_check_results values (check_name, ok, detail);
end;
$$;

grant execute on function pg_temp.record_check(text, boolean, text) to authenticated;

create or replace function pg_temp.expect_denied(check_name text, statement text)
returns void
language plpgsql
as $$
begin
  execute statement;
  perform pg_temp.record_check(check_name, false, 'statement was allowed: ' || statement);
exception
  when insufficient_privilege or check_violation or with_check_option_violation then
    perform pg_temp.record_check(check_name, true, null);
end;
$$;

grant execute on function pg_temp.expect_denied(text, text) to authenticated;

select set_config('request.jwt.claim.sub', :'learner_a_id', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select pg_temp.record_check(
  'learner A can read own profile',
  (select count(*) = 1 from public.profiles where id = :'learner_a_id'::uuid),
  'own profile should be visible'
);

select pg_temp.record_check(
  'learner A cannot read learner B profile',
  (select count(*) = 0 from public.profiles where id = :'learner_b_id'::uuid),
  'other profile must be hidden'
);

select pg_temp.record_check(
  'published mission content is readable',
  (select count(*) > 0 from public.missions where publication_status = 'published'),
  'published content should remain public to authenticated clients'
);

select pg_temp.expect_denied(
  'direct profile mutation is denied',
  'update public.profiles set completed_sessions = completed_sessions + 1 where id = ' || quote_literal(:'learner_a_id')
);

select pg_temp.expect_denied(
  'direct session creation is denied',
  'insert into public.sessions (user_id, mission_id, plan, current_index) values (' ||
  quote_literal(:'learner_a_id') || ', ''rls-probe'', ''{}''::jsonb, 0)'
);

select pg_temp.expect_denied(
  'direct friend request creation is denied',
  'insert into public.friend_requests (from_user_id, to_user_id) values (' ||
  quote_literal(:'learner_a_id') || ', ' || quote_literal(:'learner_b_id') || ')'
);

select pg_temp.expect_denied(
  'direct friendship creation is denied',
  'insert into public.friendships (user_one_id, user_two_id) values (' ||
  quote_literal(:'learner_a_id') || ', ' || quote_literal(:'learner_b_id') || ')'
);

select pg_temp.expect_denied(
  'direct social block creation is denied',
  'insert into public.social_blocks (blocker_user_id, blocked_user_id) values (' ||
  quote_literal(:'learner_a_id') || ', ' || quote_literal(:'learner_b_id') || ')'
);

select pg_temp.expect_denied(
  'direct social report creation is denied',
  'insert into public.social_reports (reporter_user_id, reported_user_id, reason) values (' ||
  quote_literal(:'learner_a_id') || ', ' || quote_literal(:'learner_b_id') || ', ''other'')'
);

select pg_temp.expect_denied(
  'direct co-op challenge creation is denied',
  'insert into public.coop_challenges (created_by_user_id, friend_user_id, title, target_sessions) values (' ||
  quote_literal(:'learner_a_id') || ', ' || quote_literal(:'learner_b_id') || ', ''RLS probe'', 1)'
);

reset role;

select *
from rls_check_results
order by check_name;

do $$
begin
  if exists (select 1 from rls_check_results where not ok) then
    raise exception 'RLS checklist failed. Inspect rls_check_results output above.';
  end if;
end;
$$;

rollback;
