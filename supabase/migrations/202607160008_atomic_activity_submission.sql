-- Commit one activity response and every learner-state transition it produces
-- in a single transaction. The request UUID is scoped to the learner so an
-- HTTP retry cannot create a second attempt or advance the session twice.

-- Supabase projects commonly install pgcrypto in `extensions`, while the
-- original schema allowed PostgreSQL's default installation schema. Normalize
-- it once so every SECURITY DEFINER function can use a qualified, trusted name.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $migration$
declare
  v_pgcrypto_schema text;
begin
  select nsp.nspname
  into v_pgcrypto_schema
  from pg_catalog.pg_extension as ext
  join pg_catalog.pg_namespace as nsp on nsp.oid = ext.extnamespace
  where ext.extname = 'pgcrypto';

  if v_pgcrypto_schema is distinct from 'extensions' then
    alter extension pgcrypto set schema extensions;
  end if;
end;
$migration$;

alter table public.activity_attempts
  add column if not exists request_id uuid,
  add column if not exists request_fingerprint bytea
    check (request_fingerprint is null or octet_length(request_fingerprint) = 32);

-- The application computes the pedagogical transition before calling the RPC.
-- Revisions turn those absolute next-state rows into optimistic writes: a
-- concurrent response must reload and recompute instead of overwriting newer
-- mistake or review counters.
alter table public.mistake_patterns
  add column if not exists transition_revision bigint not null default 0
    check (transition_revision >= 0);

alter table public.mistake_patterns
  add column if not exists created_at timestamptz;

update public.mistake_patterns
set created_at = coalesce(created_at, last_seen_at, now())
where created_at is null;

alter table public.mistake_patterns
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.review_items
  add column if not exists transition_revision bigint not null default 0
    check (transition_revision >= 0);

comment on column public.activity_attempts.request_id is
  'Learner-scoped idempotency key supplied by the trusted activity-submission service.';

comment on column public.activity_attempts.request_fingerprint is
  'SHA-256 of the stable learner action, used to reject an idempotency key reused for a different submission.';

comment on column public.mistake_patterns.transition_revision is
  'Optimistic concurrency revision for atomic activity-submission transitions.';

comment on column public.review_items.transition_revision is
  'Optimistic concurrency revision for atomic activity-submission transitions.';

create unique index if not exists activity_attempts_user_request_key
  on public.activity_attempts (user_id, request_id)
  where request_id is not null;

-- Completion credit repeatedly aggregates this small, session-scoped set.
-- Legacy null evidence kinds retain the application's controlled-evidence
-- fallback and are therefore intentionally not excluded by this index.
create index if not exists activity_attempts_session_coverage_idx
  on public.activity_attempts (session_id, activity_id)
  where completed and evidence_kind is distinct from 'self-report';

-- Every writer, including a rolling-version direct upsert, advances the CAS
-- token. New RPC writes set the next value explicitly; this trigger also covers
-- older writers that do not know the column exists.
create or replace function public.bump_learning_transition_revision()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  new.transition_revision := old.transition_revision + 1;
  return new;
end;
$$;

revoke all on function public.bump_learning_transition_revision()
  from public, anon, authenticated;
grant execute on function public.bump_learning_transition_revision()
  to service_role;

drop trigger if exists mistake_patterns_bump_transition_revision
  on public.mistake_patterns;
create trigger mistake_patterns_bump_transition_revision
  before update on public.mistake_patterns
  for each row execute function public.bump_learning_transition_revision();

drop trigger if exists review_items_bump_transition_revision
  on public.review_items;
create trigger review_items_bump_transition_revision
  before update on public.review_items
  for each row execute function public.bump_learning_transition_revision();

create or replace function public.submit_activity_attempt(
  p_user_id uuid,
  p_session_id uuid,
  p_request_id uuid,
  p_expected_current_index integer,
  p_activity_id text,
  p_submitted_answer text,
  p_latency_ms integer,
  p_result_json jsonb,
  p_completed boolean,
  p_is_correct boolean,
  p_evidence_kind text,
  p_mistake_event jsonb default null,
  p_mistake_pattern jsonb default null,
  p_review_item jsonb default null
) returns public.activity_attempts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_existing_attempt public.activity_attempts%rowtype;
  v_attempt public.activity_attempts%rowtype;
  v_profile public.profiles%rowtype;
  v_existing_pattern public.mistake_patterns%rowtype;
  v_existing_review public.review_items%rowtype;

  v_created_at timestamptz := statement_timestamp();
  v_request_fingerprint bytea;
  v_total_activities integer;
  v_expected_activity_id text;
  v_current_activity_type text;
  v_current_estimated_seconds integer;
  v_new_index integer;
  v_checked_activities integer;
  v_required_activities integer;

  v_event_id uuid;
  v_event_content_item_id text;
  v_event_rule_id text;
  v_event_corrected_answer text;
  v_event_mistake_type text;
  v_event_explanation text;

  v_supplied_pattern_id uuid;
  v_pattern_id uuid;
  v_pattern_rule_id text;
  v_pattern_mistake_type text;
  v_pattern_corrected_answer text;
  v_pattern_explanation text;
  v_pattern_repeat_count integer;
  v_pattern_success_count integer;
  v_pattern_resolved boolean;
  v_expected_pattern_revision bigint;

  v_review_id text;
  v_review_content_item_id text;
  v_review_activity_id text;
  v_review_rule_id text;
  v_review_prompt text;
  v_review_expected_answers jsonb;
  v_review_stage integer;
  v_review_due_at timestamptz;
  v_review_success_count integer;
  v_review_failure_count integer;
  v_review_priority integer;
  v_expected_review_revision bigint;
  v_expected_review_stage integer;
  v_expected_review_priority integer;
  v_expected_review_due_days integer;

  v_today date;
  v_previous_day date;
  v_day_gap integer;
  v_new_streak integer;
  v_new_freezes integer;
begin
  if p_user_id is null
    or p_session_id is null
    or p_request_id is null
    or p_expected_current_index is null
    or p_expected_current_index < 0
    or nullif(btrim(p_activity_id), '') is null
    or p_submitted_answer is null
    or p_latency_ms is null
    or p_latency_ms < 0
    or p_latency_ms > 1800000
    or char_length(p_submitted_answer) > 500
    or p_completed is null
    or p_is_correct is null
    or p_evidence_kind is null
    or p_evidence_kind not in ('recognition', 'controlled', 'free-production', 'self-report')
    or jsonb_typeof(p_result_json) is distinct from 'object'
    or jsonb_typeof(p_result_json -> 'isCorrect') is distinct from 'boolean'
    or jsonb_typeof(p_result_json -> 'shouldCreateReview') is distinct from 'boolean' then
    raise exception 'Invalid activity submission.' using errcode = '22023';
  end if;

  if (p_result_json ->> 'isCorrect')::boolean is distinct from p_is_correct then
    raise exception 'Attempt correctness does not match its result payload.' using errcode = '22023';
  end if;

  if p_evidence_kind = 'self-report' and p_is_correct then
    raise exception 'Self-reported evidence cannot receive correctness credit.' using errcode = '22023';
  end if;

  if p_evidence_kind = 'self-report'
    and (p_mistake_event is not null or p_mistake_pattern is not null or p_review_item is not null) then
    raise exception 'Self-reported evidence cannot change mistake or review state.' using errcode = '22023';
  end if;

  if (p_result_json ->> 'shouldCreateReview')::boolean
    and (p_is_correct or p_mistake_event is null or p_mistake_pattern is null or p_review_item is null) then
    raise exception 'A review-creating miss requires its complete transition state.' using errcode = '22023';
  end if;

  if p_mistake_event is not null
    and (p_is_correct or not (p_result_json ->> 'shouldCreateReview')::boolean) then
    raise exception 'A mistake event requires a review-creating miss.' using errcode = '22023';
  end if;

  if not p_completed
    and (
      p_is_correct
      or p_evidence_kind = 'self-report'
      or not (p_result_json ->> 'shouldCreateReview')::boolean
    ) then
    raise exception 'Only a scored first miss may remain on the current step.' using errcode = '22023';
  end if;

  -- jsonb has a deterministic key order and representation. Only stable,
  -- authoritative learner-action fields belong in this fingerprint: completion
  -- state, transition revisions, generated IDs, and due dates can legitimately
  -- differ when two same-request HTTP handlers race. The first committed
  -- transition remains authoritative and the second call returns its attempt.
  v_request_fingerprint := extensions.digest(
    jsonb_build_object(
      'user_id', p_user_id,
      'session_id', p_session_id,
      'activity_id', p_activity_id,
      'submitted_answer', p_submitted_answer,
      'latency_ms', p_latency_ms,
      'result_json', p_result_json,
      'is_correct', p_is_correct,
      'evidence_kind', p_evidence_kind
    )::text,
    'sha256'
  );

  -- This lock covers the small chance of one request UUID being retried against
  -- two different sessions concurrently. The unique index remains the durable
  -- integrity constraint.
  perform pg_advisory_xact_lock(
    hashtextextended('activity-submission:' || p_user_id::text || ':' || p_request_id::text, 0)
  );
  -- Mistake patterns and review items are learner-scoped, so serialize the
  -- short state mutation even if two separate sessions finish concurrently.
  perform pg_advisory_xact_lock(
    hashtextextended('activity-submission-user:' || p_user_id::text, 0)
  );

  -- Lock the parent profile before its session children. Profile deletion
  -- follows the same parent-to-child order through ON DELETE CASCADE, so a
  -- final answer and a concurrent privacy deletion cannot deadlock.
  select *
  into v_profile
  from public.profiles
  where id = p_user_id
  for key share;

  if not found then
    raise exception 'Learner profile not found.' using errcode = 'P0002';
  end if;

  select *
  into v_session
  from public.sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Learning session not found.' using errcode = 'P0002';
  end if;

  if v_session.user_id is distinct from p_user_id then
    raise exception 'Learning session owner does not match.' using errcode = '42501';
  end if;

  -- A genuine retry is successful even though the first transaction has
  -- already advanced or completed the session. Reusing a key for different
  -- semantic request data is rejected instead of returning an unrelated response.
  select *
  into v_existing_attempt
  from public.activity_attempts
  where user_id = p_user_id
    and request_id = p_request_id;

  if found then
    if v_existing_attempt.session_id is distinct from p_session_id
      or v_existing_attempt.activity_id is distinct from p_activity_id
      or v_existing_attempt.submitted_answer is distinct from p_submitted_answer
      or v_existing_attempt.latency_ms is distinct from p_latency_ms
      or v_existing_attempt.result_json is distinct from p_result_json
      or v_existing_attempt.is_correct is distinct from p_is_correct
      or v_existing_attempt.evidence_kind is distinct from p_evidence_kind
      or v_existing_attempt.request_fingerprint is distinct from v_request_fingerprint then
      raise exception 'Activity request ID was reused with different data.' using errcode = '22000';
    end if;

    return v_existing_attempt;
  end if;

  if v_session.completed_at is not null then
    raise exception 'Learning session is already complete.' using errcode = '55000';
  end if;

  if jsonb_typeof(v_session.plan_json -> 'activities') is distinct from 'array' then
    raise exception 'Learning session has an invalid activity plan.' using errcode = '55000';
  end if;

  v_total_activities := jsonb_array_length(v_session.plan_json -> 'activities');
  if v_total_activities < 1
    or v_session.current_index < 0
    or v_session.current_index >= v_total_activities then
    raise exception 'Learning session has an invalid current step.' using errcode = '55000';
  end if;

  if v_session.current_index is distinct from p_expected_current_index then
    raise exception 'Learning session step changed before submission.' using errcode = '40001';
  end if;

  v_expected_activity_id := v_session.plan_json #>> array[
    'activities',
    p_expected_current_index::text,
    'activity',
    'id'
  ];
  v_current_activity_type := v_session.plan_json #>> array[
    'activities',
    p_expected_current_index::text,
    'activity',
    'type'
  ];
  v_current_estimated_seconds := nullif(v_session.plan_json #>> array[
    'activities',
    p_expected_current_index::text,
    'activity',
    'estimatedSeconds'
  ], '')::integer;

  if nullif(v_expected_activity_id, '') is null
    or v_expected_activity_id is distinct from p_activity_id
    or nullif(v_current_activity_type, '') is null
    or v_current_estimated_seconds is null
    or v_current_estimated_seconds not between 1 and 3600 then
    raise exception 'Activity is not the current session step.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.activities
    where id = p_activity_id
      and mission_id = v_session.mission_id
  ) then
    raise exception 'Activity does not belong to the session mission.' using errcode = '22023';
  end if;

  if not p_completed and exists (
    select 1
    from public.activity_attempts
    where user_id = p_user_id
      and session_id = p_session_id
      and activity_id = p_activity_id
      and not completed
      and not is_correct
      and coalesce(evidence_kind, 'controlled') <> 'self-report'
  ) then
    -- A different request already recorded the first miss while this caller
    -- was computing its transition. Reload so this response becomes the
    -- completed retry instead of persisting two first misses.
    raise exception 'First-miss state changed before submission.' using errcode = '40001';
  end if;

  insert into public.activity_attempts (
    id,
    request_id,
    request_fingerprint,
    user_id,
    session_id,
    activity_id,
    submitted_answer,
    latency_ms,
    result_json,
    is_correct,
    completed,
    evidence_kind,
    created_at
  ) values (
    pg_catalog.gen_random_uuid(),
    p_request_id,
    v_request_fingerprint,
    p_user_id,
    p_session_id,
    p_activity_id,
    p_submitted_answer,
    p_latency_ms,
    p_result_json,
    p_is_correct,
    p_completed,
    p_evidence_kind,
    v_created_at
  )
  returning * into v_attempt;

  -- Optional transition objects use database column names. Pattern and review
  -- objects also carry expected_revision from the state used to compute them.
  -- Identity and
  -- linkage fields are either verified or derived from the locked submission;
  -- callers cannot attach transition state to another learner or session.
  if p_mistake_event is not null then
    if jsonb_typeof(p_mistake_event) is distinct from 'object' then
      raise exception 'Invalid mistake event transition.' using errcode = '22023';
    end if;

    if (p_mistake_event ? 'user_id'
        and nullif(p_mistake_event ->> 'user_id', '')::uuid is distinct from p_user_id)
      or (p_mistake_event ? 'session_id'
        and nullif(p_mistake_event ->> 'session_id', '')::uuid is distinct from p_session_id)
      or (p_mistake_event ? 'activity_id'
        and nullif(p_mistake_event ->> 'activity_id', '') is distinct from p_activity_id)
      or (p_mistake_event ? 'submitted_answer'
        and p_mistake_event ->> 'submitted_answer' is distinct from p_submitted_answer) then
      raise exception 'Mistake event linkage does not match the submission.' using errcode = '22023';
    end if;

    v_event_id := coalesce(nullif(p_mistake_event ->> 'id', '')::uuid, pg_catalog.gen_random_uuid());
    v_event_content_item_id := nullif(p_mistake_event ->> 'content_item_id', '');
    v_event_rule_id := nullif(btrim(p_mistake_event ->> 'rule_id'), '');
    v_event_corrected_answer := nullif(p_mistake_event ->> 'corrected_answer', '');
    v_event_mistake_type := nullif(btrim(p_mistake_event ->> 'mistake_type'), '');
    v_event_explanation := nullif(p_mistake_event ->> 'explanation', '');

    if v_event_content_item_id is null
      or v_event_rule_id is null
      or v_event_corrected_answer is null
      or v_event_mistake_type is null
      or v_event_explanation is null then
      raise exception 'Mistake event is missing required transition data.' using errcode = '22023';
    end if;

    if v_event_content_item_id is not null and not exists (
      select 1
      from public.activity_content_links
      where activity_id = p_activity_id
        and content_item_id = v_event_content_item_id
    ) then
      raise exception 'Mistake event content is not linked to the activity.' using errcode = '22023';
    end if;

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
      explanation,
      created_at
    ) values (
      v_event_id,
      p_user_id,
      p_session_id,
      p_activity_id,
      v_event_content_item_id,
      v_event_rule_id,
      p_submitted_answer,
      v_event_corrected_answer,
      v_event_mistake_type,
      v_event_explanation,
      v_created_at
    );
  end if;

  if p_mistake_pattern is not null then
    if jsonb_typeof(p_mistake_pattern) is distinct from 'object'
      or jsonb_typeof(p_mistake_pattern -> 'repeat_count') is distinct from 'number'
      or jsonb_typeof(p_mistake_pattern -> 'separate_production_successes') is distinct from 'number'
      or jsonb_typeof(p_mistake_pattern -> 'resolved') is distinct from 'boolean'
      or jsonb_typeof(p_mistake_pattern -> 'expected_revision') is distinct from 'number' then
      raise exception 'Invalid mistake pattern transition.' using errcode = '22023';
    end if;

    if p_mistake_pattern ? 'user_id'
      and nullif(p_mistake_pattern ->> 'user_id', '')::uuid is distinct from p_user_id then
      raise exception 'Mistake pattern owner does not match the submission.' using errcode = '22023';
    end if;

    v_supplied_pattern_id := nullif(p_mistake_pattern ->> 'id', '')::uuid;
    v_pattern_rule_id := nullif(btrim(p_mistake_pattern ->> 'rule_id'), '');
    v_pattern_mistake_type := nullif(btrim(p_mistake_pattern ->> 'mistake_type'), '');
    v_pattern_corrected_answer := nullif(p_mistake_pattern ->> 'corrected_answer', '');
    v_pattern_explanation := nullif(p_mistake_pattern ->> 'explanation', '');
    v_pattern_repeat_count := (p_mistake_pattern ->> 'repeat_count')::integer;
    v_pattern_success_count := (p_mistake_pattern ->> 'separate_production_successes')::integer;
    v_pattern_resolved := (p_mistake_pattern ->> 'resolved')::boolean;
    v_expected_pattern_revision := (p_mistake_pattern ->> 'expected_revision')::bigint;

    if v_pattern_rule_id is null
      or v_pattern_mistake_type is null
      or v_pattern_corrected_answer is null
      or v_pattern_explanation is null
      or v_pattern_repeat_count < 1
      or v_pattern_success_count < 0
      or v_expected_pattern_revision < 0 then
      raise exception 'Mistake pattern is missing required transition data.' using errcode = '22023';
    end if;

    if v_event_rule_id is not null and v_event_rule_id is distinct from v_pattern_rule_id then
      raise exception 'Mistake event and pattern rule IDs do not match.' using errcode = '22023';
    end if;

    select *
    into v_existing_pattern
    from public.mistake_patterns
    where user_id = p_user_id
      and rule_id = v_pattern_rule_id
    for update;

    if found then
      if v_supplied_pattern_id is not null
        and v_supplied_pattern_id is distinct from v_existing_pattern.id then
        raise exception 'Mistake pattern ID does not match existing state.' using errcode = '22023';
      end if;

      if v_existing_pattern.transition_revision is distinct from v_expected_pattern_revision then
        raise exception 'Mistake pattern changed before submission.' using errcode = '40001';
      end if;

      if p_is_correct then
        if not p_completed
          or v_current_activity_type not in ('typing', 'fill_blank', 'sentence_builder')
          or v_existing_pattern.resolved
          or v_pattern_mistake_type is distinct from v_existing_pattern.mistake_type
          or v_pattern_corrected_answer is distinct from v_existing_pattern.corrected_answer
          or v_pattern_explanation is distinct from v_existing_pattern.explanation
          or v_pattern_repeat_count is distinct from v_existing_pattern.repeat_count
          or v_pattern_success_count is distinct from v_existing_pattern.separate_production_successes + 1
          or v_pattern_resolved is distinct from
            (v_existing_pattern.separate_production_successes + 1 >= 2) then
          raise exception 'Mistake repair counters do not follow the current state.' using errcode = '22023';
        end if;
      elsif not (p_result_json ->> 'shouldCreateReview')::boolean
        or v_pattern_repeat_count is distinct from v_existing_pattern.repeat_count + 1
        or v_pattern_success_count <> 0
        or v_pattern_resolved then
        raise exception 'Mistake counters do not follow the current state.' using errcode = '22023';
      end if;

      v_pattern_id := v_existing_pattern.id;
      update public.mistake_patterns
      set mistake_type = v_pattern_mistake_type,
          corrected_answer = v_pattern_corrected_answer,
          explanation = v_pattern_explanation,
          repeat_count = v_pattern_repeat_count,
          separate_production_successes = v_pattern_success_count,
          resolved = v_pattern_resolved,
          last_seen_at = v_created_at,
          transition_revision = transition_revision + 1
      where id = v_pattern_id;
    else
      if v_expected_pattern_revision <> 0 then
        raise exception 'Mistake pattern changed before submission.' using errcode = '40001';
      end if;

      if p_is_correct
        or not (p_result_json ->> 'shouldCreateReview')::boolean
        or v_pattern_repeat_count <> 1
        or v_pattern_success_count <> 0
        or v_pattern_resolved then
        raise exception 'A new mistake pattern must begin with one unresolved miss.' using errcode = '22023';
      end if;

      v_pattern_id := coalesce(v_supplied_pattern_id, pg_catalog.gen_random_uuid());
      insert into public.mistake_patterns (
        id,
        user_id,
        rule_id,
        mistake_type,
        corrected_answer,
        explanation,
        repeat_count,
        separate_production_successes,
        resolved,
        created_at,
        last_seen_at,
        transition_revision
      ) values (
        v_pattern_id,
        p_user_id,
        v_pattern_rule_id,
        v_pattern_mistake_type,
        v_pattern_corrected_answer,
        v_pattern_explanation,
        v_pattern_repeat_count,
        v_pattern_success_count,
        v_pattern_resolved,
        v_created_at,
        v_created_at,
        1
      );
    end if;
  end if;

  if p_review_item is not null then
    if jsonb_typeof(p_review_item) is distinct from 'object'
      or jsonb_typeof(p_review_item -> 'expected_answers') is distinct from 'array'
      or jsonb_typeof(p_review_item -> 'stage') is distinct from 'number'
      or jsonb_typeof(p_review_item -> 'success_count') is distinct from 'number'
      or jsonb_typeof(p_review_item -> 'failure_count') is distinct from 'number'
      or jsonb_typeof(p_review_item -> 'priority') is distinct from 'number'
      or jsonb_typeof(p_review_item -> 'expected_revision') is distinct from 'number' then
      raise exception 'Invalid review item transition.' using errcode = '22023';
    end if;

    if p_review_item ? 'user_id'
      and nullif(p_review_item ->> 'user_id', '')::uuid is distinct from p_user_id then
      raise exception 'Review item linkage does not match the submission.' using errcode = '22023';
    end if;

    v_review_id := nullif(p_review_item ->> 'id', '');
    v_review_content_item_id := nullif(p_review_item ->> 'content_item_id', '');
    v_review_activity_id := nullif(p_review_item ->> 'activity_id', '');
    v_review_rule_id := nullif(p_review_item ->> 'rule_id', '');
    v_review_prompt := nullif(p_review_item ->> 'prompt', '');
    v_review_expected_answers := p_review_item -> 'expected_answers';
    v_review_stage := (p_review_item ->> 'stage')::integer;
    v_review_due_at := nullif(p_review_item ->> 'due_at', '')::timestamptz;
    v_review_success_count := (p_review_item ->> 'success_count')::integer;
    v_review_failure_count := (p_review_item ->> 'failure_count')::integer;
    v_review_priority := (p_review_item ->> 'priority')::integer;
    v_expected_review_revision := (p_review_item ->> 'expected_revision')::bigint;

    if v_review_id is null
      or char_length(v_review_id) > 500
      or v_review_content_item_id is null
      or v_review_activity_id is null
      or v_review_prompt is null
      or v_review_due_at is null
      or v_review_stage not between 0 and 4
      or v_review_success_count < 0
      or v_review_failure_count < 0
      or v_review_priority < 0
      or v_expected_review_revision < 0 then
      raise exception 'Review item is missing required transition data.' using errcode = '22023';
    end if;

    if v_event_rule_id is not null and v_review_rule_id is distinct from v_event_rule_id then
      raise exception 'Mistake event and review item rule IDs do not match.' using errcode = '22023';
    end if;

    if v_event_content_item_id is not null
      and v_review_content_item_id is distinct from v_event_content_item_id then
      raise exception 'Mistake event and review item content IDs do not match.' using errcode = '22023';
    end if;

    if v_pattern_rule_id is not null and v_review_rule_id is distinct from v_pattern_rule_id then
      raise exception 'Mistake pattern and review item rule IDs do not match.' using errcode = '22023';
    end if;

    -- A review retains the activity that originally created it. A later
    -- activity may update the same learner/content/rule review key, so verify
    -- both activities against the shared content rather than forcing their IDs
    -- to be equal.
    if not exists (
      select 1
      from public.activity_content_links
      where activity_id = p_activity_id
        and content_item_id = v_review_content_item_id
    ) then
      raise exception 'Review item content is not linked to the current activity.' using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.activity_content_links as link
      join public.activities as activity on activity.id = link.activity_id
      where link.activity_id = v_review_activity_id
        and link.content_item_id = v_review_content_item_id
        and activity.mission_id = v_session.mission_id
    ) then
      raise exception 'Review item identity is not linked to the session mission.' using errcode = '22023';
    end if;

    select *
    into v_existing_review
    from public.review_items
    where id = v_review_id
    for update;

    if found then
      if v_existing_review.user_id is distinct from p_user_id
        or v_existing_review.content_item_id is distinct from v_review_content_item_id
        or v_existing_review.activity_id is distinct from v_review_activity_id
        or v_existing_review.rule_id is distinct from v_review_rule_id then
        raise exception 'Review item identity does not match existing state.' using errcode = '22023';
      end if;

      if v_existing_review.transition_revision is distinct from v_expected_review_revision then
        raise exception 'Review item changed before submission.' using errcode = '40001';
      end if;

      if v_review_prompt is distinct from v_existing_review.prompt
        or v_review_expected_answers is distinct from v_existing_review.expected_answers then
        raise exception 'Review teaching content cannot change during a response transition.' using errcode = '22023';
      end if;

      if p_is_correct then
        if v_review_success_count is distinct from v_existing_review.success_count + 1
          or v_review_failure_count is distinct from v_existing_review.failure_count then
          raise exception 'Review success counters do not follow the current state.' using errcode = '22023';
        end if;

        if v_current_activity_type = 'multiple_choice'
          or p_latency_ms > v_current_estimated_seconds * 1000 * 1.5 then
          v_expected_review_stage := v_existing_review.stage;
          v_expected_review_priority := v_existing_review.priority + 1;
          v_expected_review_due_days := case when v_existing_review.stage = 0 then 1 else 3 end;
        elsif p_latency_ms < v_current_estimated_seconds * 1000 * 0.55 then
          v_expected_review_stage := least(4, v_existing_review.stage + 2);
          v_expected_review_priority := greatest(0, v_existing_review.priority - 1);
          v_expected_review_due_days := (array[1, 3, 7, 14, 30])[v_expected_review_stage + 1];
        else
          v_expected_review_stage := least(4, v_existing_review.stage + 1);
          v_expected_review_priority := greatest(0, v_existing_review.priority - 1);
          v_expected_review_due_days := (array[1, 3, 7, 14, 30])[v_expected_review_stage + 1];
        end if;
      else
        if not (p_result_json ->> 'shouldCreateReview')::boolean
          or v_review_success_count is distinct from v_existing_review.success_count
          or v_review_failure_count is distinct from v_existing_review.failure_count + 1 then
          raise exception 'Review failure counters do not follow the current state.' using errcode = '22023';
        end if;

        v_expected_review_stage := greatest(0, v_existing_review.stage - 1);
        v_expected_review_priority := greatest(v_existing_review.priority + 2, 2);
        v_expected_review_due_days := 1;
      end if;

      if v_review_stage is distinct from v_expected_review_stage
        or v_review_priority is distinct from v_expected_review_priority
        or abs(
          extract(epoch from (v_review_due_at - v_created_at))
          - v_expected_review_due_days * 86400
        ) > 600 then
        raise exception 'Review schedule does not follow the current state.' using errcode = '22023';
      end if;

      update public.review_items
      set prompt = v_review_prompt,
          expected_answers = v_review_expected_answers,
          stage = v_review_stage,
          due_at = v_review_due_at,
          success_count = v_review_success_count,
          failure_count = v_review_failure_count,
          priority = v_review_priority,
          updated_at = v_created_at,
          transition_revision = transition_revision + 1
      where id = v_review_id;
    else
      -- Guard the secondary natural key explicitly so a bad caller-provided ID
      -- cannot collide with the same review under another primary key.
      select *
      into v_existing_review
      from public.review_items
      where user_id = p_user_id
        and content_item_id = v_review_content_item_id
        and rule_id is not distinct from v_review_rule_id
      limit 1
      for update;

      if found then
        raise exception 'Review item ID does not match existing natural-key state.' using errcode = '22023';
      end if;

      if v_expected_review_revision <> 0 then
        raise exception 'Review item changed before submission.' using errcode = '40001';
      end if;

      if p_is_correct
        or not (p_result_json ->> 'shouldCreateReview')::boolean
        or v_review_stage <> 0
        or v_review_success_count <> 0
        or v_review_failure_count <> 1
        or v_review_priority <> 2
        or abs(extract(epoch from (v_review_due_at - v_created_at)) - 86400) > 600 then
        raise exception 'A new review item must begin with one due-soon miss.' using errcode = '22023';
      end if;

      insert into public.review_items (
        id,
        user_id,
        content_item_id,
        activity_id,
        rule_id,
        prompt,
        expected_answers,
        stage,
        due_at,
        success_count,
        failure_count,
        priority,
        created_at,
        updated_at,
        transition_revision
      ) values (
        v_review_id,
        p_user_id,
        v_review_content_item_id,
        v_review_activity_id,
        v_review_rule_id,
        v_review_prompt,
        v_review_expected_answers,
        v_review_stage,
        v_review_due_at,
        v_review_success_count,
        v_review_failure_count,
        v_review_priority,
        v_created_at,
        v_created_at,
        1
      );
    end if;
  end if;

  if p_completed then
    -- The row lock plus the expected-index check makes this an exact +1, never
    -- a last-write-wins jump and never a second advance for a retry.
    v_new_index := v_session.current_index + 1;

    update public.sessions
    set current_index = v_new_index,
        completed_at = case
          when v_new_index = v_total_activities then v_created_at
          else null
        end
    where id = p_session_id;

    if v_new_index = v_total_activities then
      -- Count the complete session aggregate after inserting this attempt.
      -- Correctness is intentionally irrelevant: checking an answer is valid
      -- participation, while self-report evidence is not mastery evidence.
      select count(distinct attempt.activity_id)::integer
      into v_checked_activities
      from public.activity_attempts as attempt
      where attempt.user_id = p_user_id
        and attempt.session_id = p_session_id
        and attempt.completed
        and coalesce(attempt.evidence_kind, 'controlled') <> 'self-report'
        and exists (
          select 1
          from jsonb_array_elements(v_session.plan_json -> 'activities') as planned(entry)
          where planned.entry #>> '{activity,id}' = attempt.activity_id
        );

      v_required_activities := greatest(
        1,
        ceil(v_total_activities::numeric * 0.60)::integer
      );

      if v_checked_activities >= v_required_activities then
        select *
        into v_profile
        from public.profiles
        where id = p_user_id
        for update;

        if not found then
          raise exception 'Learner profile not found.' using errcode = 'P0002';
        end if;

        v_new_streak := greatest(v_profile.current_streak, 0);
        v_new_freezes := least(greatest(coalesce(v_profile.streak_freezes, 0), 0), 2);
        v_today := (v_created_at at time zone v_profile.time_zone)::date;

        if v_profile.last_completed_at is null then
          v_new_streak := 1;
        else
          v_previous_day := (v_profile.last_completed_at at time zone v_profile.time_zone)::date;
          v_day_gap := v_today - v_previous_day;

          if v_day_gap <= 0 then
            -- More than one credited session today updates recency but does not
            -- inflate the streak or repeatedly award a seven-day freeze.
            null;
          elsif v_day_gap = 1 then
            v_new_streak := v_new_streak + 1;
            if mod(v_new_streak, 7) = 0 and v_new_freezes < 2 then
              v_new_freezes := v_new_freezes + 1;
            end if;
          elsif v_day_gap = 2 and v_new_freezes > 0 then
            v_new_streak := v_new_streak + 1;
            v_new_freezes := v_new_freezes - 1;
            if mod(v_new_streak, 7) = 0 and v_new_freezes < 2 then
              v_new_freezes := v_new_freezes + 1;
            end if;
          else
            v_new_streak := 1;
          end if;
        end if;

        update public.profiles
        set last_completed_at = v_created_at,
            completed_sessions = completed_sessions + 1,
            current_streak = v_new_streak,
            streak_freezes = v_new_freezes,
            updated_at = v_created_at
        where id = p_user_id;
      end if;
    end if;
  end if;

  return v_attempt;
end;
$$;

comment on function public.submit_activity_attempt(
  uuid, uuid, uuid, integer, text, text, integer, jsonb, boolean, boolean, text, jsonb, jsonb, jsonb
) is
  'Atomically records one idempotent activity attempt, CAS-checked mistake/review transitions, exact session advancement, and aggregate-qualified completion credit. Transition JSON uses database column names plus expected_revision.';

revoke all on function public.submit_activity_attempt(
  uuid, uuid, uuid, integer, text, text, integer, jsonb, boolean, boolean, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.submit_activity_attempt(
  uuid, uuid, uuid, integer, text, text, integer, jsonb, boolean, boolean, text, jsonb, jsonb, jsonb
) to service_role;
