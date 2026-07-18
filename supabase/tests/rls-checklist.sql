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

-- Seed one safety relationship as the database owner so both sides of the
-- select policy can be checked without relying on a client write.
insert into public.social_blocks (blocker_user_id, blocked_user_id)
values (:'learner_a_id'::uuid, :'learner_b_id'::uuid)
on conflict do nothing;

create temp table rls_probe_ids on commit drop as
select
  gen_random_uuid() as session_id,
  gen_random_uuid() as session_request_id,
  gen_random_uuid() as attempt_id,
  gen_random_uuid() as mistake_event_id,
  gen_random_uuid() as mistake_pattern_id,
  ('rls-review-' || gen_random_uuid()::text) as review_id,
  ('rls-rule-' || gen_random_uuid()::text) as rule_id,
  gen_random_uuid() as report_id,
  gen_random_uuid() as challenge_id;

insert into public.sessions (
  id,
  user_id,
  mission_id,
  plan_json,
  mode,
  started_at,
  current_index
)
select
  probe.session_id,
  :'learner_a_id'::uuid,
  'mission-introduce-yourself-v1',
  '{"probe":"private plan material"}'::jsonb,
  'normal',
  now(),
  0
from rls_probe_ids as probe;

insert into public.session_start_requests (
  user_id,
  request_id,
  session_id,
  request_fingerprint
)
select
  :'learner_a_id'::uuid,
  probe.session_request_id,
  probe.session_id,
  decode(repeat('00', 32), 'hex')
from rls_probe_ids as probe;

insert into public.activity_attempts (
  id,
  user_id,
  session_id,
  activity_id,
  submitted_answer,
  latency_ms,
  result_json,
  is_correct,
  completed,
  evidence_kind
)
select
  probe.attempt_id,
  :'learner_a_id'::uuid,
  probe.session_id,
  'act-age-fill-v1',
  'probe answer',
  1,
  '{"isCorrect":false,"correctAnswer":"private correction","shouldCreateReview":true}'::jsonb,
  false,
  true,
  'controlled'
from rls_probe_ids as probe;

insert into public.mistake_events (
  id,
  user_id,
  session_id,
  activity_id,
  content_item_id,
  rule_id,
  submitted_answer,
  corrected_answer,
  mistake_type,
  explanation
)
select
  probe.mistake_event_id,
  :'learner_a_id'::uuid,
  probe.session_id,
  'act-age-fill-v1',
  'rule-age-avoir-v1',
  probe.rule_id,
  'probe answer',
  'private correction',
  'grammar',
  'private explanation'
from rls_probe_ids as probe;

insert into public.mistake_patterns (
  id,
  user_id,
  rule_id,
  mistake_type,
  corrected_answer,
  explanation
)
select
  probe.mistake_pattern_id,
  :'learner_a_id'::uuid,
  probe.rule_id,
  'grammar',
  'private correction',
  'private explanation'
from rls_probe_ids as probe;

insert into public.review_items (
  id,
  user_id,
  content_item_id,
  activity_id,
  rule_id,
  prompt,
  expected_answers,
  due_at
)
select
  probe.review_id,
  :'learner_a_id'::uuid,
  'rule-age-avoir-v1',
  'act-age-fill-v1',
  probe.rule_id,
  'Private review probe',
  '["private answer"]'::jsonb,
  now()
from rls_probe_ids as probe;

insert into public.friend_requests (
  from_user_id,
  to_user_id,
  status,
  responded_at
)
values (
  :'learner_a_id'::uuid,
  :'learner_b_id'::uuid,
  'declined',
  now()
)
on conflict (from_user_id, to_user_id)
do update set
  status = 'declined',
  responded_at = now();

insert into public.friendships (user_one_id, user_two_id)
values (
  least(:'learner_a_id', :'learner_b_id')::uuid,
  greatest(:'learner_a_id', :'learner_b_id')::uuid
)
on conflict (user_one_id, user_two_id) do nothing;

insert into public.social_reports (
  id,
  reporter_user_id,
  reported_user_id,
  reason
)
select
  probe.report_id,
  :'learner_a_id'::uuid,
  :'learner_b_id'::uuid,
  'other'
from rls_probe_ids as probe;

insert into public.coop_challenges (
  id,
  created_by_user_id,
  friend_user_id,
  title,
  target_sessions,
  starting_sessions,
  status,
  completed_at
)
select
  probe.challenge_id,
  :'learner_a_id'::uuid,
  :'learner_b_id'::uuid,
  'Private challenge probe',
  1,
  jsonb_build_object(
    :'learner_a_id',
    0,
    :'learner_b_id',
    0
  ),
  'completed',
  now()
from rls_probe_ids as probe;

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
declare
  affected_rows bigint;
begin
  execute statement;
  get diagnostics affected_rows = row_count;
  perform pg_temp.record_check(
    check_name,
    affected_rows = 0,
    case when affected_rows = 0 then null else 'statement changed ' || affected_rows || ' row(s): ' || statement end
  );
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
  'session plans are server-only',
  'select plan_json from public.sessions where user_id = ' || quote_literal(:'learner_a_id')
);

select pg_temp.expect_denied(
  'session start request ledgers are server-only',
  'select session_id from public.session_start_requests where user_id = ' ||
    quote_literal(:'learner_a_id')
);

select pg_temp.expect_denied(
  'attempt results are server-only',
  'select result_json from public.activity_attempts where user_id = ' || quote_literal(:'learner_a_id')
);

select pg_temp.expect_denied(
  'mistake events are server-only',
  'select corrected_answer, explanation from public.mistake_events where user_id = ' ||
    quote_literal(:'learner_a_id')
);

select pg_temp.expect_denied(
  'mistake patterns are server-only',
  'select corrected_answer, explanation from public.mistake_patterns where user_id = ' ||
    quote_literal(:'learner_a_id')
);

select pg_temp.expect_denied(
  'review answers are server-only',
  'select expected_answers from public.review_items where user_id = ' || quote_literal(:'learner_a_id')
);

select pg_temp.expect_denied(
  'activity payloads are server-only',
  'select payload from public.activities where id = ''act-age-fill-v1'''
);

select pg_temp.expect_denied(
  'accepted answer sets are server-only',
  'select canonical_answer, valid_variants from public.accepted_answer_sets ' ||
    'where activity_id = ''act-age-fill-v1'''
);

select pg_temp.expect_denied(
  'friend requests are API-only',
  'select to_user_id from public.friend_requests where from_user_id = ' ||
    quote_literal(:'learner_a_id')
);

select pg_temp.expect_denied(
  'friendships are API-only',
  'select user_one_id, user_two_id from public.friendships where user_one_id = ' ||
    quote_literal(least(:'learner_a_id', :'learner_b_id'))
);

select pg_temp.expect_denied(
  'social blocks are API-only',
  'select blocked_user_id from public.social_blocks where blocker_user_id = ' ||
    quote_literal(:'learner_a_id')
);

select pg_temp.expect_denied(
  'social reports are API-only',
  'select reported_user_id from public.social_reports where reporter_user_id = ' ||
    quote_literal(:'learner_a_id')
);

select pg_temp.expect_denied(
  'co-op challenges are API-only',
  'select friend_user_id from public.coop_challenges where created_by_user_id = ' ||
    quote_literal(:'learner_a_id')
);

select pg_temp.record_check(
  'session creation RPC is service-role only',
  not has_function_privilege(
    'authenticated',
    'public.create_or_resume_learning_session(uuid,uuid,uuid,text,jsonb,text,timestamp with time zone,boolean)',
    'EXECUTE'
  ),
  'authenticated must not execute the session creation RPC'
);

select pg_temp.record_check(
  'quota RPC is service-role only',
  not has_function_privilege(
    'authenticated',
    'public.consume_api_quota(uuid,text,integer,integer,uuid)',
    'EXECUTE'
  ),
  'authenticated must not consume server quotas directly'
);

select pg_temp.record_check(
  'tutor claim RPC is service-role only',
  not has_function_privilege(
    'authenticated',
    'public.claim_tutor_interaction(uuid,uuid,text,jsonb)',
    'EXECUTE'
  ),
  'authenticated must not claim paid tutor work directly'
);

select pg_temp.record_check(
  'social unblock RPC is service-role only',
  not has_function_privilege(
    'authenticated',
    'public.unblock_social_user(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated must not mutate blocks directly'
);

select pg_temp.record_check(
  'progress aggregation RPCs are service-role only',
  not has_function_privilege(
    'authenticated',
    'public.get_progress_attempt_signals(uuid)',
    'EXECUTE'
  ) and not has_function_privilege(
    'authenticated',
    'public.get_progress_mistake_signals(uuid)',
    'EXECUTE'
  ),
  'authenticated must not query raw progress aggregates directly'
);

select pg_temp.expect_denied(
  'direct profile mutation is denied',
  'update public.profiles set completed_sessions = completed_sessions + 1 where id = ' || quote_literal(:'learner_a_id')
);

select pg_temp.expect_denied(
  'direct session creation is denied',
  'insert into public.sessions (id, user_id, mission_id, plan_json, mode, started_at, current_index) values (' ||
  'gen_random_uuid(), ' || quote_literal(:'learner_a_id') || ', ''mission-introduce-yourself-v1'', ' ||
  '''{}''::jsonb, ''normal'', now(), 0)'
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
  quote_literal(:'learner_b_id') || ', ' || quote_literal(:'learner_a_id') || ')'
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

select set_config('request.jwt.claim.sub', :'learner_b_id', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select pg_temp.expect_denied(
  'blocked learner cannot identify the blocker',
  'select blocker_user_id from public.social_blocks where blocked_user_id = ' ||
    quote_literal(:'learner_b_id')
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
