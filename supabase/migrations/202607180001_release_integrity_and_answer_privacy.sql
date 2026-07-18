-- Final release integrity upgrade for deployed and freshly provisioned projects.
-- Learning plans and answer-bearing state are server-only, session creation is
-- atomic per learner, and retry-safe quota events consume capacity only once.

-- ---------------------------------------------------------------------------
-- Display-name normalization and spoofing resistance
-- ---------------------------------------------------------------------------

create or replace function public.normalize_display_name(
  p_display_name text
) returns text
language plpgsql
immutable
strict
parallel safe
set search_path = pg_catalog, pg_temp
as $$
declare
  v_character text;
  v_code_point integer;
  v_index integer;
  v_output text := '';
  v_pending_space boolean := false;
begin
  for v_index in 1..char_length(p_display_name) loop
    v_character := substr(p_display_name, v_index, 1);
    v_code_point := ascii(v_character);

    -- Collapse ASCII and Unicode spacing characters to one ordinary space.
    if v_code_point between 9 and 13
      or v_code_point in (32, 133, 160, 5760, 8232, 8233, 8239, 8287, 12288)
      or v_code_point between 8192 and 8202 then
      if v_output <> '' then
        v_pending_space := true;
      end if;
      continue;
    end if;

    -- Remove C0/C1 controls and Unicode format controls, including bidi
    -- overrides, isolates, zero-width controls, and language-tag characters.
    if v_code_point between 0 and 31
      or v_code_point between 127 and 159
      or v_code_point = 173
      or v_code_point between 1536 and 1541
      or v_code_point in (1564, 1757, 1807, 2274, 6158, 65279, 917505)
      or v_code_point between 2192 and 2193
      or v_code_point between 8203 and 8207
      or v_code_point between 8234 and 8238
      or v_code_point between 8288 and 8292
      or v_code_point between 8294 and 8303
      or v_code_point between 55296 and 63743
      or v_code_point between 65529 and 65531
      or v_code_point in (69821, 69837)
      or v_code_point between 78896 and 78911
      or v_code_point between 113824 and 113827
      or v_code_point between 119155 and 119162
      or v_code_point between 917536 and 917631 then
      continue;
    end if;

    -- Private-use characters can carry app-specific glyphs and are rejected
    -- consistently with the application validation boundary.
    if v_code_point between 983040 and 1048573
      or v_code_point between 1048576 and 1114109 then
      continue;
    end if;

    if v_pending_space then
      v_output := v_output || ' ';
      v_pending_space := false;
    end if;

    v_output := v_output || v_character;
  end loop;

  v_output := normalize(v_output, NFC);
  v_output := rtrim(left(v_output, 60), ' ');
  if v_output = '' then
    return 'Learner';
  end if;

  return v_output;
end;
$$;

alter function public.normalize_display_name(text)
  owner to postgres;
revoke all on function public.normalize_display_name(text)
  from public, anon, authenticated;
grant execute on function public.normalize_display_name(text)
  to service_role;

update public.profiles
set
  display_name = public.normalize_display_name(display_name),
  updated_at = now()
where display_name is distinct from public.normalize_display_name(display_name);

alter table public.profiles
  drop constraint if exists profiles_display_name_integrity;

alter table public.profiles
  add constraint profiles_display_name_integrity
    check (
      char_length(display_name) between 1 and 60
      and display_name = public.normalize_display_name(display_name)
    ) not valid;

alter table public.profiles
  validate constraint profiles_display_name_integrity;

comment on function public.normalize_display_name(text) is
  'Produces an NFC 1-60 character name with ordinary spacing and no control, format, bidi-control, surrogate, or private-use characters.';

-- ---------------------------------------------------------------------------
-- Private learner state and answer-bearing curriculum
-- ---------------------------------------------------------------------------

alter table public.sessions enable row level security;
alter table public.activity_attempts enable row level security;
alter table public.mistake_events enable row level security;
alter table public.mistake_patterns enable row level security;
alter table public.review_items enable row level security;
alter table public.activities enable row level security;
alter table public.accepted_answer_sets enable row level security;

drop policy if exists "users own sessions" on public.sessions;
drop policy if exists "users read own sessions" on public.sessions;

drop policy if exists "users own attempts" on public.activity_attempts;
drop policy if exists "users read own attempts" on public.activity_attempts;

drop policy if exists "users own mistake events" on public.mistake_events;
drop policy if exists "users read own mistake events" on public.mistake_events;

drop policy if exists "users own mistake patterns" on public.mistake_patterns;
drop policy if exists "users read own mistake patterns" on public.mistake_patterns;

drop policy if exists "users own review items" on public.review_items;
drop policy if exists "users read own review items" on public.review_items;

drop policy if exists "published activities readable" on public.activities;
drop policy if exists "owners manage activities" on public.activities;

drop policy if exists "published answer sets readable" on public.accepted_answer_sets;
drop policy if exists "owners manage answer sets" on public.accepted_answer_sets;

-- RLS remains the row-level boundary, while explicit privilege removal makes
-- accidental future permissive policies insufficient on their own. Reviewed
-- curriculum is provisioned by migrations; runtime access uses service_role.
revoke all on table
  public.sessions,
  public.activity_attempts,
  public.mistake_events,
  public.mistake_patterns,
  public.review_items,
  public.activities,
  public.accepted_answer_sets
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.sessions,
  public.activity_attempts,
  public.mistake_events,
  public.mistake_patterns,
  public.review_items,
  public.activities,
  public.accepted_answer_sets
to service_role;

comment on table public.sessions is
  'Server-only learner sessions; plan_json can contain authoritative answer-validation material.';
comment on table public.activity_attempts is
  'Server-only attempts; result_json may contain corrections that must not be revealed early.';
comment on table public.review_items is
  'Server-only review state; expected_answers is redacted from learner-facing responses.';
comment on table public.activities is
  'Reviewed curriculum served through answer-redacting server routes.';
comment on table public.accepted_answer_sets is
  'Authoritative answers available only to trusted server and migration roles.';

-- Social API responses intentionally omit internal learner identifiers and
-- hidden safety relationships. Prevent direct PostgREST reads from bypassing
-- those DTOs.
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.social_blocks enable row level security;
alter table public.social_reports enable row level security;
alter table public.coop_challenges enable row level security;

drop policy if exists "users see own friend requests" on public.friend_requests;
drop policy if exists "users send own friend requests" on public.friend_requests;
drop policy if exists "request recipients respond" on public.friend_requests;
drop policy if exists "friends see own friendships" on public.friendships;
drop policy if exists "friends create own friendships" on public.friendships;
drop policy if exists "friends remove own friendships" on public.friendships;
drop policy if exists "users manage own blocks" on public.social_blocks;
drop policy if exists "users see own blocks" on public.social_blocks;
drop policy if exists "users see blocks they created" on public.social_blocks;
drop policy if exists "users create own reports" on public.social_reports;
drop policy if exists "users see own reports" on public.social_reports;
drop policy if exists "challenge participants see challenges" on public.coop_challenges;
drop policy if exists "challenge participants create challenges" on public.coop_challenges;
drop policy if exists "challenge participants update challenges" on public.coop_challenges;

revoke all on table
  public.friend_requests,
  public.friendships,
  public.social_blocks,
  public.social_reports,
  public.coop_challenges
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.friend_requests,
  public.friendships,
  public.social_blocks,
  public.social_reports,
  public.coop_challenges
to service_role;

create or replace function public.unblock_social_user(
  p_user_id uuid,
  p_target_user_id uuid
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_removed_rows integer;
begin
  if p_user_id is null
    or p_target_user_id is null
    or p_user_id = p_target_user_id then
    raise exception 'An unblock requires two different learners.' using errcode = '22023';
  end if;

  perform public.lock_social_pair(p_user_id, p_target_user_id);

  delete from public.social_blocks
  where blocker_user_id = p_user_id
    and blocked_user_id = p_target_user_id;

  get diagnostics v_removed_rows = row_count;
  return v_removed_rows = 1;
end;
$$;

alter function public.unblock_social_user(uuid, uuid)
  owner to postgres;
revoke all on function public.unblock_social_user(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.unblock_social_user(uuid, uuid)
  to service_role;

comment on function public.unblock_social_user(uuid, uuid) is
  'Removes only the caller-owned directed block under the canonical social pair lock.';

create or replace function public.get_progress_attempt_signals(
  p_user_id uuid
) returns table (
  activity_id text,
  is_correct boolean,
  completed boolean,
  evidence_kind text,
  attempt_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if p_user_id is null then
    raise exception 'A learner ID is required.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = p_user_id
  ) then
    raise exception 'Learner profile not found.' using errcode = 'P0002';
  end if;

  return query
  select
    attempt.activity_id,
    attempt.is_correct,
    attempt.completed,
    attempt.evidence_kind,
    count(*)::bigint
  from public.activity_attempts as attempt
  where attempt.user_id = p_user_id
  group by
    attempt.activity_id,
    attempt.is_correct,
    attempt.completed,
    attempt.evidence_kind
  order by
    attempt.activity_id,
    attempt.is_correct,
    attempt.completed,
    attempt.evidence_kind;
end;
$$;

alter function public.get_progress_attempt_signals(uuid)
  owner to postgres;
revoke all on function public.get_progress_attempt_signals(uuid)
  from public, anon, authenticated;
grant execute on function public.get_progress_attempt_signals(uuid)
  to service_role;

comment on function public.get_progress_attempt_signals(uuid) is
  'Returns bounded grouped attempt evidence for server-side progress aggregation.';

create or replace function public.get_progress_mistake_signals(
  p_user_id uuid
) returns table (
  resolved boolean,
  mistake_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if p_user_id is null then
    raise exception 'A learner ID is required.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = p_user_id
  ) then
    raise exception 'Learner profile not found.' using errcode = 'P0002';
  end if;

  return query
  select
    pattern.resolved,
    count(*)::bigint
  from public.mistake_patterns as pattern
  where pattern.user_id = p_user_id
  group by pattern.resolved
  order by pattern.resolved;
end;
$$;

alter function public.get_progress_mistake_signals(uuid)
  owner to postgres;
revoke all on function public.get_progress_mistake_signals(uuid)
  from public, anon, authenticated;
grant execute on function public.get_progress_mistake_signals(uuid)
  to service_role;

comment on function public.get_progress_mistake_signals(uuid) is
  'Returns bounded grouped mistake state for server-side progress aggregation.';

-- ---------------------------------------------------------------------------
-- Retry-aware API quotas
-- ---------------------------------------------------------------------------

alter table public.api_rate_events
  add column if not exists request_id uuid;

alter table public.api_rate_events enable row level security;
revoke all on table public.api_rate_events
  from public, anon, authenticated;
grant select, insert, delete on table public.api_rate_events
  to service_role;

create unique index if not exists api_rate_events_user_action_request_key
  on public.api_rate_events (user_id, action, request_id)
  where request_id is not null;

drop function if exists public.consume_api_quota(uuid, text, integer, integer);

create or replace function public.consume_api_quota(
  p_user_id uuid,
  p_action text,
  p_window_seconds integer,
  p_limit integer,
  p_request_id uuid
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_cutoff timestamptz;
begin
  if p_user_id is null
    or p_action is null
    or p_window_seconds is null
    or p_limit is null
    or char_length(p_action) not between 1 and 60
    or p_window_seconds not between 1 and 604800
    or p_limit not between 1 and 10000 then
    raise exception 'Invalid API quota request.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('api-quota:' || p_user_id::text || ':' || p_action, 0)
  );

  -- All supported windows are at most seven days. Pruning first prevents an
  -- expired idempotency key from being kept alive by repeated replays.
  delete from public.api_rate_events
  where user_id = p_user_id
    and created_at < now() - interval '8 days';

  if p_request_id is not null and exists (
    select 1
    from public.api_rate_events
    where user_id = p_user_id
      and action = p_action
      and request_id = p_request_id
  ) then
    return true;
  end if;

  v_cutoff := now() - make_interval(secs => p_window_seconds);

  if (
    select count(*)
    from public.api_rate_events
    where user_id = p_user_id
      and action = p_action
      and created_at >= v_cutoff
  ) >= p_limit then
    return false;
  end if;

  insert into public.api_rate_events (user_id, action, request_id)
  values (p_user_id, p_action, p_request_id);

  return true;
end;
$$;

alter function public.consume_api_quota(uuid, text, integer, integer, uuid)
  owner to postgres;
revoke all on function public.consume_api_quota(uuid, text, integer, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.consume_api_quota(uuid, text, integer, integer, uuid)
  to service_role;

comment on column public.api_rate_events.request_id is
  'Optional action-scoped idempotency key supplied by a trusted server route.';
comment on function public.consume_api_quota(uuid, text, integer, integer, uuid) is
  'Atomically consumes quota once per non-null action-scoped request ID.';

-- ---------------------------------------------------------------------------
-- One paid tutor claim per learner attempt
-- ---------------------------------------------------------------------------

update public.ai_interactions as interaction
set attempt_id = interaction.id
from public.activity_attempts as attempt
where interaction.attempt_id is null
  and attempt.id = interaction.id
  and attempt.user_id = interaction.user_id
  and not exists (
    select 1
    from public.ai_interactions as other
    where other.user_id = interaction.user_id
      and other.attempt_id = interaction.id
      and other.id <> interaction.id
  );

create or replace function public.claim_tutor_interaction(
  p_user_id uuid,
  p_attempt_id uuid,
  p_interaction_type text,
  p_context_pack_summary jsonb
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_existing public.ai_interactions%rowtype;
begin
  if p_user_id is null
    or p_attempt_id is null
    or nullif(btrim(p_interaction_type), '') is null
    or char_length(p_interaction_type) > 60
    or p_interaction_type ~ '[[:cntrl:]]'
    or jsonb_typeof(p_context_pack_summary) is distinct from 'object'
    or pg_column_size(p_context_pack_summary) > 65536 then
    raise exception 'Invalid tutor interaction claim.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tutor-interaction:' || p_user_id::text || ':' || p_attempt_id::text,
      0
    )
  );

  perform attempt.id
  from public.activity_attempts as attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = p_user_id
  for key share;

  if not found then
    raise exception 'Tutor attempt not found.' using errcode = 'P0002';
  end if;

  select interaction.*
  into v_existing
  from public.ai_interactions as interaction
  where interaction.id = p_attempt_id
    or (
      interaction.user_id = p_user_id
      and interaction.attempt_id = p_attempt_id
    )
  order by
    case when interaction.attempt_id = p_attempt_id then 0 else 1 end,
    interaction.created_at
  limit 1
  for update;

  if not found then
    insert into public.ai_interactions (
      id,
      user_id,
      interaction_type,
      attempt_id,
      context_pack_summary,
      response_summary,
      provider,
      created_at
    ) values (
      p_attempt_id,
      p_user_id,
      p_interaction_type,
      p_attempt_id,
      p_context_pack_summary,
      '{}'::jsonb,
      'pending',
      statement_timestamp()
    );

    return true;
  end if;

  if v_existing.user_id is distinct from p_user_id then
    raise exception 'Tutor interaction owner does not match.' using errcode = '42501';
  end if;

  if v_existing.provider = 'pending'
    and v_existing.created_at <= statement_timestamp() - interval '30 seconds' then
    update public.ai_interactions
    set
      attempt_id = p_attempt_id,
      interaction_type = p_interaction_type,
      context_pack_summary = p_context_pack_summary,
      response_summary = '{}'::jsonb,
      provider = 'pending',
      created_at = statement_timestamp()
    where id = v_existing.id;

    return true;
  end if;

  return false;
end;
$$;

alter function public.claim_tutor_interaction(uuid, uuid, text, jsonb)
  owner to postgres;
revoke all on function public.claim_tutor_interaction(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.claim_tutor_interaction(uuid, uuid, text, jsonb)
  to service_role;

comment on function public.claim_tutor_interaction(uuid, uuid, text, jsonb) is
  'Claims one tutor provider call per learner attempt; abandoned pending claims become reclaimable after 30 seconds.';

-- ---------------------------------------------------------------------------
-- Atomic create-or-resume learning sessions
-- ---------------------------------------------------------------------------

create table if not exists public.session_start_requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  session_id uuid not null references public.sessions(id) on delete cascade,
  request_fingerprint bytea not null
    check (octet_length(request_fingerprint) = 32),
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

create index if not exists session_start_requests_session_idx
  on public.session_start_requests (session_id);

create index if not exists session_start_requests_retention_idx
  on public.session_start_requests (created_at);

alter table public.session_start_requests enable row level security;
revoke all on table public.session_start_requests
  from public, anon, authenticated;
grant select, insert, update, delete on table public.session_start_requests
  to service_role;

comment on table public.session_start_requests is
  'Private eight-day idempotency ledger for create-or-resume session requests.';
comment on column public.session_start_requests.request_fingerprint is
  'SHA-256 of mission, mode, lesson intent, and restart semantics.';

drop function if exists public.create_or_resume_learning_session(
  uuid, uuid, text, jsonb, text, timestamptz, boolean
);

drop function if exists public.create_or_resume_learning_session(
  uuid, uuid, uuid, text, jsonb, text, timestamptz, boolean
);

create function public.create_or_resume_learning_session(
  p_user_id uuid,
  p_session_id uuid,
  p_request_id uuid,
  p_mission_id text,
  p_plan_json jsonb,
  p_mode text,
  p_started_at timestamptz,
  p_resume_if_available boolean
) returns public.sessions
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_time_zone text;
  v_focused_review boolean;
  v_existing public.sessions%rowtype;
  v_session public.sessions%rowtype;
  v_start_request public.session_start_requests%rowtype;
  v_request_fingerprint bytea;
  v_planned_count integer;
  v_distinct_activity_count integer;
begin
  if p_user_id is null
    or p_session_id is null
    or p_request_id is null
    or nullif(btrim(p_mission_id), '') is null
    or char_length(p_mission_id) > 200
    or p_mission_id ~ '[[:cntrl:]]'
    or p_mode is null
    or p_mode not in ('normal', 'two_minute', 'comeback')
    or p_started_at is null
    or not isfinite(p_started_at)
    or p_resume_if_available is null
    or jsonb_typeof(p_plan_json) is distinct from 'object'
    or pg_column_size(p_plan_json) > 1048576 then
    raise exception 'Invalid learning session request.' using errcode = '22023';
  end if;

  -- Every start for one learner enters the same critical section. The profile
  -- parent is then locked before any session child, matching submission and
  -- privacy-deletion lock ordering.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('learning-session-start:' || p_user_id::text, 0)
  );

  select profile.time_zone
  into v_time_zone
  from public.profiles as profile
  where profile.id = p_user_id
  for key share;

  if not found then
    raise exception 'Learner profile not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = v_time_zone
  ) then
    raise exception 'Learner profile has an invalid time zone.' using errcode = '23514';
  end if;

  if jsonb_typeof(p_plan_json -> 'id') is distinct from 'string'
    or nullif(btrim(p_plan_json ->> 'id'), '') is null
    or char_length(p_plan_json ->> 'id') > 300
    or jsonb_typeof(p_plan_json -> 'userId') is distinct from 'string'
    or p_plan_json ->> 'userId' is distinct from p_user_id::text
    or jsonb_typeof(p_plan_json -> 'missionId') is distinct from 'string'
    or p_plan_json ->> 'missionId' is distinct from p_mission_id
    or jsonb_typeof(p_plan_json -> 'mode') is distinct from 'string'
    or p_plan_json ->> 'mode' is distinct from p_mode
    or jsonb_typeof(p_plan_json -> 'estimatedMinutes') is distinct from 'number'
    or jsonb_typeof(p_plan_json -> 'activities') is distinct from 'array' then
    raise exception 'Learning session plan does not match its request.' using errcode = '22023';
  end if;

  if (p_plan_json ->> 'estimatedMinutes')::numeric not between 1 and 60
    or trunc((p_plan_json ->> 'estimatedMinutes')::numeric)
      is distinct from (p_plan_json ->> 'estimatedMinutes')::numeric
    or jsonb_array_length(p_plan_json -> 'activities') not between 1 and 100 then
    raise exception 'Learning session duration or activity count is invalid.' using errcode = '22023';
  end if;

  if p_plan_json ? 'missionTitle'
    and (
      jsonb_typeof(p_plan_json -> 'missionTitle') is distinct from 'string'
      or nullif(btrim(p_plan_json ->> 'missionTitle'), '') is null
      or char_length(p_plan_json ->> 'missionTitle') > 200
      or p_plan_json ->> 'missionTitle' ~ '[[:cntrl:]]'
    ) then
    raise exception 'Learning session mission title is invalid.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_plan_json -> 'activities') as planned(entry)
    where jsonb_typeof(planned.entry) is distinct from 'object'
      or jsonb_typeof(planned.entry -> 'activity') is distinct from 'object'
      or jsonb_typeof(planned.entry #> '{activity,id}') is distinct from 'string'
      or jsonb_typeof(planned.entry #> '{activity,type}') is distinct from 'string'
      or jsonb_typeof(planned.entry #> '{activity,estimatedSeconds}') is distinct from 'number'
      or jsonb_typeof(planned.entry -> 'kind') is distinct from 'string'
  ) then
    raise exception 'Learning session contains malformed activities.' using errcode = '22023';
  end if;

  select
    count(*),
    count(distinct planned.entry #>> '{activity,id}')
  into
    v_planned_count,
    v_distinct_activity_count
  from jsonb_array_elements(p_plan_json -> 'activities') as planned(entry);

  if v_planned_count is distinct from v_distinct_activity_count
    or exists (
      select 1
      from jsonb_array_elements(p_plan_json -> 'activities') as planned(entry)
      where (planned.entry #>> '{activity,estimatedSeconds}')::numeric not between 1 and 3600
        or trunc((planned.entry #>> '{activity,estimatedSeconds}')::numeric)
          is distinct from (planned.entry #>> '{activity,estimatedSeconds}')::numeric
        or planned.entry ->> 'kind' not in ('review', 'mission', 'repair')
        or not exists (
          select 1
          from public.activities as activity
          where activity.id = planned.entry #>> '{activity,id}'
            and activity.mission_id = p_mission_id
            and activity.activity_type = planned.entry #>> '{activity,type}'
            and activity.publication_status = 'published'
        )
    ) then
    raise exception 'Learning session contains invalid or unpublished activities.' using errcode = '22023';
  end if;

  v_focused_review := coalesce(
    p_plan_json ->> 'missionTitle' = 'Focused review',
    false
  );

  v_request_fingerprint := extensions.digest(
    jsonb_build_object(
      'mission_id', p_mission_id,
      'mode', p_mode,
      'focused_review', v_focused_review,
      'resume_if_available', p_resume_if_available
    )::text,
    'sha256'
  );

  delete from public.session_start_requests
  where user_id = p_user_id
    and created_at < now() - interval '8 days';

  select start_request.*
  into v_start_request
  from public.session_start_requests as start_request
  where start_request.user_id = p_user_id
    and start_request.request_id = p_request_id
  for update;

  if found then
    if v_start_request.request_fingerprint is distinct from v_request_fingerprint then
      raise exception 'Session start request ID was reused for a different intent.' using errcode = '22000';
    end if;

    select session.*
    into v_existing
    from public.sessions as session
    where session.id = v_start_request.session_id
      and session.user_id = p_user_id
    for update;

    if not found then
      raise exception 'Session start request refers to missing state.' using errcode = '55000';
    end if;

    return v_existing;
  end if;

  if not exists (
    select 1
    from public.missions
    where id = p_mission_id
      and publication_status = 'published'
  ) then
    raise exception 'Learning mission is not published.' using errcode = '22023';
  end if;

  -- A transport retry with the same generated session UUID is idempotent even
  -- if the session has since advanced or completed.
  select session.*
  into v_existing
  from public.sessions as session
  where session.id = p_session_id
  for update;

  if found then
    if v_existing.user_id is distinct from p_user_id
      or v_existing.mission_id is distinct from p_mission_id
      or v_existing.plan_json is distinct from p_plan_json
      or v_existing.mode is distinct from p_mode
      or v_existing.started_at is distinct from p_started_at then
      raise exception 'Learning session ID was reused with different data.' using errcode = '22000';
    end if;

    insert into public.session_start_requests (
      user_id,
      request_id,
      session_id,
      request_fingerprint,
      created_at
    ) values (
      p_user_id,
      p_request_id,
      v_existing.id,
      v_request_fingerprint,
      statement_timestamp()
    );

    return v_existing;
  end if;

  if p_resume_if_available then
    select session.*
    into v_existing
    from public.sessions as session
    where session.user_id = p_user_id
      and session.mission_id = p_mission_id
      and session.mode = p_mode
      and session.completed_at is null
      and (session.started_at at time zone v_time_zone)::date =
        (p_started_at at time zone v_time_zone)::date
      and coalesce(
        session.plan_json ->> 'missionTitle' = 'Focused review',
        false
      ) = v_focused_review
    order by session.started_at desc, session.created_at desc, session.id desc
    limit 1
    for update;

    if found then
      insert into public.session_start_requests (
        user_id,
        request_id,
        session_id,
        request_fingerprint,
        created_at
      ) values (
        p_user_id,
        p_request_id,
        v_existing.id,
        v_request_fingerprint,
        statement_timestamp()
      );

      return v_existing;
    end if;
  end if;

  insert into public.sessions (
    id,
    user_id,
    mission_id,
    plan_json,
    mode,
    started_at,
    current_index
  ) values (
    p_session_id,
    p_user_id,
    p_mission_id,
    p_plan_json,
    p_mode,
    p_started_at,
    0
  )
  returning * into v_session;

  insert into public.session_start_requests (
    user_id,
    request_id,
    session_id,
    request_fingerprint,
    created_at
  ) values (
    p_user_id,
    p_request_id,
    v_session.id,
    v_request_fingerprint,
    statement_timestamp()
  );

  return v_session;
end;
$$;

alter function public.create_or_resume_learning_session(
  uuid, uuid, uuid, text, jsonb, text, timestamptz, boolean
) owner to postgres;
revoke all on function public.create_or_resume_learning_session(
  uuid, uuid, uuid, text, jsonb, text, timestamptz, boolean
) from public, anon, authenticated;
grant execute on function public.create_or_resume_learning_session(
  uuid, uuid, uuid, text, jsonb, text, timestamptz, boolean
) to service_role;

comment on function public.create_or_resume_learning_session(
  uuid, uuid, uuid, text, jsonb, text, timestamptz, boolean
) is
  'Request-idempotently validates, creates, or resumes the matching learner-local-day session.';

-- ---------------------------------------------------------------------------
-- Recipient-side pending friend-request cap
-- ---------------------------------------------------------------------------

create or replace function public.enforce_pending_friend_request_recipient_cap()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_recipient_id uuid;
  v_enters_pending boolean;
begin
  v_enters_pending := case
    when tg_op = 'INSERT' then new.status = 'pending'
    when tg_op = 'UPDATE' then old.status <> 'pending' and new.status = 'pending'
    else false
  end;

  if not v_enters_pending then
    return new;
  end if;

  v_recipient_id := new.to_user_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'friend-request-recipient:' || v_recipient_id::text,
      0
    )
  );

  -- Tie the lock to a live profile parent before inspecting its child rows.
  perform profile.id
  from public.profiles as profile
  where profile.id = v_recipient_id
  for key share;

  if not found then
    raise exception 'That learner is not available.' using errcode = 'P0001';
  end if;

  if (
    select count(*)
    from public.friend_requests as request
    where request.to_user_id = v_recipient_id
      and request.status = 'pending'
  ) >= 100 then
    raise exception 'That learner has too many pending friend requests.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

alter function public.enforce_pending_friend_request_recipient_cap()
  owner to postgres;
revoke all on function public.enforce_pending_friend_request_recipient_cap()
  from public, anon, authenticated;

drop trigger if exists friend_requests_enforce_recipient_cap
  on public.friend_requests;
create trigger friend_requests_enforce_recipient_cap
  before insert or update of status
  on public.friend_requests
  for each row
  execute function public.enforce_pending_friend_request_recipient_cap();

comment on function public.enforce_pending_friend_request_recipient_cap() is
  'Serializes friend-request state by recipient and rejects a 101st pending inbound request.';

-- ---------------------------------------------------------------------------
-- Bounded friend-code rotation idempotency
-- ---------------------------------------------------------------------------

create index if not exists friend_code_rotation_requests_user_created_idx
  on public.friend_code_rotation_requests (user_id, created_at);

create index if not exists friend_code_rotation_requests_retention_idx
  on public.friend_code_rotation_requests (created_at);

create or replace function public.rotate_friend_code(
  p_user_id uuid,
  p_request_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $$
declare
  v_rotated_code text;
begin
  if p_user_id is null or p_request_id is null then
    raise exception 'A profile and request ID are required.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('friend-code-rotation:' || p_user_id::text, 0)
  );

  -- Rotation retries are supported for eight days. Pruning before lookup keeps
  -- replayed expired keys from extending the private ledger indefinitely.
  delete from public.friend_code_rotation_requests
  where user_id = p_user_id
    and created_at < now() - interval '8 days';

  select request.rotated_code
  into v_rotated_code
  from public.friend_code_rotation_requests as request
  where request.user_id = p_user_id
    and request.request_id = p_request_id;

  if found then
    return v_rotated_code;
  end if;

  update public.profiles
  set
    friend_code = public.random_friend_code(),
    updated_at = now()
  where id = p_user_id
  returning friend_code into v_rotated_code;

  if v_rotated_code is null then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  insert into public.friend_code_rotation_requests (
    user_id,
    request_id,
    rotated_code
  ) values (
    p_user_id,
    p_request_id,
    v_rotated_code
  );

  return v_rotated_code;
end;
$$;

alter function public.rotate_friend_code(uuid, uuid)
  owner to postgres;
revoke all on function public.rotate_friend_code(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.rotate_friend_code(uuid, uuid)
  to service_role;

comment on function public.rotate_friend_code(uuid, uuid) is
  'Rotates once per request ID, serializes per learner, and retains retry records for eight days.';

-- Per-learner cleanup runs on each relevant action. Global jobs also bound
-- records for learners who perform an action once and never return.
create extension if not exists pg_cron with schema pg_catalog;

do $retention$
declare
  v_existing_job_id bigint;
begin
  select jobid
  into v_existing_job_id
  from cron.job
  where jobname = 'prune-expired-friend-code-rotation-requests'
  limit 1;

  if v_existing_job_id is not null then
    perform cron.unschedule(v_existing_job_id);
  end if;

  perform cron.schedule(
    'prune-expired-friend-code-rotation-requests',
    '27 * * * *',
    $job$
      delete from public.friend_code_rotation_requests
      where created_at < now() - interval '8 days'
    $job$
  );

  select jobid
  into v_existing_job_id
  from cron.job
  where jobname = 'prune-expired-session-start-requests'
  limit 1;

  if v_existing_job_id is not null then
    perform cron.unschedule(v_existing_job_id);
  end if;

  perform cron.schedule(
    'prune-expired-session-start-requests',
    '37 * * * *',
    $job$
      delete from public.session_start_requests
      where created_at < now() - interval '8 days'
    $job$
  );
end;
$retention$;

comment on table public.friend_code_rotation_requests is
  'Private friend-code retry ledger retained for no more than approximately eight days.';
