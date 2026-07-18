-- Final integrity pass for learner-local streak dates, privacy-safe export
-- boundaries, retry-safe social actions, and one active co-op challenge per
-- participant. This migration also upgrades databases that ran the earlier
-- July 16 migrations before these invariants were added there.

alter table public.profiles
  add column if not exists time_zone text not null default 'UTC';

alter table public.profiles
  drop constraint if exists profiles_time_zone_text_check;

alter table public.profiles
  add constraint profiles_time_zone_text_check
    check (
      char_length(time_zone) between 1 and 100
      and time_zone !~ '[[:cntrl:]]'
    );

create or replace function public.is_valid_time_zone(p_time_zone text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_time_zone
  );
$$;

revoke all on function public.is_valid_time_zone(text)
  from public, anon, authenticated;
grant execute on function public.is_valid_time_zone(text)
  to service_role;

create or replace function public.validate_profile_time_zone()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if not public.is_valid_time_zone(new.time_zone) then
    raise exception 'Unknown IANA time zone.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_profile_time_zone()
  from public, anon, authenticated;

drop trigger if exists profiles_validate_time_zone on public.profiles;
create trigger profiles_validate_time_zone
  before insert or update of time_zone on public.profiles
  for each row execute function public.validate_profile_time_zone();

-- Remove the pre-time-zone overload so an omitted argument cannot silently
-- route onboarding through the old implementation.
drop function if exists public.complete_onboarding(
  uuid, text, text, text[], text[], integer, text, text[], text, boolean, text, text
);

create or replace function public.complete_onboarding(
  p_user_id uuid,
  p_display_name text,
  p_current_level text,
  p_learning_goals text[],
  p_interests text[],
  p_daily_minutes integer,
  p_preferred_mode text,
  p_focus_preferences text[],
  p_speaking_confidence text,
  p_age_confirmed boolean,
  p_policy_version text,
  p_friend_code text,
  p_time_zone text default 'UTC'
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not p_age_confirmed then
    raise exception 'Age confirmation is required.' using errcode = '22023';
  end if;

  insert into public.profiles (
    id,
    display_name,
    friend_code,
    current_level,
    learning_goals,
    interests,
    daily_minutes,
    preferred_mode,
    focus_preferences,
    speaking_confidence,
    age_confirmed,
    policy_version,
    time_zone
  ) values (
    p_user_id,
    p_display_name,
    p_friend_code,
    p_current_level,
    p_learning_goals,
    p_interests,
    p_daily_minutes,
    p_preferred_mode,
    p_focus_preferences,
    p_speaking_confidence,
    p_age_confirmed,
    p_policy_version,
    coalesce(p_time_zone, 'UTC')
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    current_level = excluded.current_level,
    learning_goals = excluded.learning_goals,
    interests = excluded.interests,
    daily_minutes = excluded.daily_minutes,
    preferred_mode = excluded.preferred_mode,
    focus_preferences = excluded.focus_preferences,
    speaking_confidence = excluded.speaking_confidence,
    age_confirmed = excluded.age_confirmed,
    policy_version = excluded.policy_version,
    time_zone = excluded.time_zone,
    updated_at = now();

  insert into public.privacy_consents (
    user_id,
    consent_type,
    policy_version,
    granted
  )
  select p_user_id, consent_type, p_policy_version, true
  from unnest(array['terms', 'privacy', 'ai_tutor']) as consent_type
  on conflict (user_id, consent_type, policy_version)
  do update set granted = true;
end;
$$;

revoke all on function public.complete_onboarding(
  uuid, text, text, text[], text[], integer, text, text[], text, boolean, text, text, text
) from public, anon, authenticated;
grant execute on function public.complete_onboarding(
  uuid, text, text, text[], text[], integer, text, text[], text, boolean, text, text, text
) to service_role;

comment on column public.profiles.time_zone is
  'Validated IANA time-zone name used for learner-local streak calendar days.';

-- Export timestamps must come from the database transaction, not from an API
-- server clock that may be skewed relative to committed rows.
create or replace function public.get_learner_export_cutoff()
returns timestamptz
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select statement_timestamp();
$$;

revoke all on function public.get_learner_export_cutoff()
  from public, anon, authenticated;
grant execute on function public.get_learner_export_cutoff()
  to service_role;

comment on function public.get_learner_export_cutoff() is
  'Returns the database statement timestamp used as a consistent learner-export upper bound.';

alter table public.mistake_patterns
  add column if not exists created_at timestamptz;

update public.mistake_patterns
set created_at = coalesce(created_at, last_seen_at, now())
where created_at is null;

alter table public.mistake_patterns
  alter column created_at set default now(),
  alter column created_at set not null;

create or replace function public.prevent_mistake_pattern_created_at_update()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.created_at is distinct from old.created_at then
    raise exception 'Mistake-pattern creation time is immutable.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_mistake_pattern_created_at_update()
  from public, anon, authenticated;

drop trigger if exists mistake_patterns_keep_created_at
  on public.mistake_patterns;
create trigger mistake_patterns_keep_created_at
  before update of created_at on public.mistake_patterns
  for each row execute function public.prevent_mistake_pattern_created_at_update();

comment on column public.mistake_patterns.created_at is
  'Immutable creation time used to bound privacy exports without omitting later-updated patterns.';

-- Preserve the complete, previously reviewed transition implementation behind
-- a parent-locking entry point. Acquiring the profile lock before a session
-- row matches profile deletion's parent-to-child cascade order.
alter function public.submit_activity_attempt(
  uuid, uuid, uuid, integer, text, text, integer, jsonb, boolean, boolean, text, jsonb, jsonb, jsonb
) rename to submit_activity_attempt_legacy;

revoke all on function public.submit_activity_attempt_legacy(
  uuid, uuid, uuid, integer, text, text, integer, jsonb, boolean, boolean, text, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;

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
begin
  perform profile.id
  from public.profiles as profile
  where profile.id = p_user_id
  for key share;

  if not found then
    raise exception 'Learner profile not found.' using errcode = 'P0002';
  end if;

  return public.submit_activity_attempt_legacy(
    p_user_id,
    p_session_id,
    p_request_id,
    p_expected_current_index,
    p_activity_id,
    p_submitted_answer,
    p_latency_ms,
    p_result_json,
    p_completed,
    p_is_correct,
    p_evidence_kind,
    p_mistake_event,
    p_mistake_pattern,
    p_review_item
  );
end;
$$;

revoke all on function public.submit_activity_attempt(
  uuid, uuid, uuid, integer, text, text, integer, jsonb, boolean, boolean, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.submit_activity_attempt(
  uuid, uuid, uuid, integer, text, text, integer, jsonb, boolean, boolean, text, jsonb, jsonb, jsonb
) to service_role;

comment on function public.submit_activity_attempt(
  uuid, uuid, uuid, integer, text, text, integer, jsonb, boolean, boolean, text, jsonb, jsonb, jsonb
) is
  'Locks the learner parent before atomically recording an idempotent activity transition.';

-- Older deployed versions of the submission RPC compared UTC dates. A BEFORE
-- trigger recalculates completion streak state from the durable old row and
-- the learner's IANA time zone, so both upgraded and fresh databases use local
-- calendar days, including across daylight-saving transitions.
create or replace function public.apply_profile_local_streak()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date;
  v_previous_day date;
  v_day_gap integer;
  v_new_streak integer;
  v_new_freezes integer;
begin
  if new.last_completed_at is null then
    raise exception 'A credited session requires a completion timestamp.' using errcode = '23514';
  end if;

  v_new_streak := greatest(old.current_streak, 0);
  v_new_freezes := least(greatest(coalesce(old.streak_freezes, 0), 0), 2);
  v_today := (new.last_completed_at at time zone new.time_zone)::date;

  if old.last_completed_at is null then
    v_new_streak := 1;
  else
    v_previous_day := (old.last_completed_at at time zone new.time_zone)::date;
    v_day_gap := v_today - v_previous_day;

    if v_day_gap <= 0 then
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

  new.current_streak := v_new_streak;
  new.streak_freezes := v_new_freezes;
  return new;
end;
$$;

revoke all on function public.apply_profile_local_streak()
  from public, anon, authenticated;

drop trigger if exists profiles_apply_local_streak on public.profiles;
create trigger profiles_apply_local_streak
  before update of completed_sessions, last_completed_at on public.profiles
  for each row
  when (new.completed_sessions > old.completed_sessions)
  execute function public.apply_profile_local_streak();

create index if not exists social_blocks_blocked_lookup_idx
  on public.social_blocks (blocked_user_id, blocker_user_id);

create index if not exists coop_challenges_friend_status_created_idx
  on public.coop_challenges (friend_user_id, status, created_at desc);

-- Retain the oldest possible non-overlapping set of active challenges. This
-- greedy reconciliation is stable across runs because ties use the row UUID.
with recursive
ordered_active_challenges as (
  select
    challenge.id,
    challenge.created_by_user_id,
    challenge.friend_user_id,
    row_number() over (
      order by challenge.created_at, challenge.id
    ) as position
  from public.coop_challenges as challenge
  where challenge.status = 'active'
),
resolved_active_challenges (
  position,
  retained_ids,
  reserved_user_ids
) as (
  select
    0::bigint,
    array[]::uuid[],
    array[]::uuid[]
  union all
  select
    ordered.position,
    case
      when ordered.created_by_user_id = any(resolved.reserved_user_ids)
        or ordered.friend_user_id = any(resolved.reserved_user_ids)
        then resolved.retained_ids
      else array_append(resolved.retained_ids, ordered.id)
    end,
    case
      when ordered.created_by_user_id = any(resolved.reserved_user_ids)
        or ordered.friend_user_id = any(resolved.reserved_user_ids)
        then resolved.reserved_user_ids
      else array_cat(
        resolved.reserved_user_ids,
        array[ordered.created_by_user_id, ordered.friend_user_id]
      )
    end
  from resolved_active_challenges as resolved
  join ordered_active_challenges as ordered
    on ordered.position = resolved.position + 1
),
retained_active_challenges as (
  select resolved.retained_ids
  from resolved_active_challenges as resolved
  order by resolved.position desc
  limit 1
)
update public.coop_challenges as challenge
set
  status = 'completed',
  completed_at = coalesce(challenge.completed_at, now())
from retained_active_challenges as retained
where challenge.status = 'active'
  and not (challenge.id = any(retained.retained_ids));

-- A unique row per active participant is the durable reservation. Unlike a
-- pair-only unique index, it rejects A-C while A-B is active, even for direct
-- service-role writes that bypass the challenge RPC.
create table if not exists public.active_coop_challenge_participants (
  user_id uuid primary key
    references public.profiles(id) on delete cascade,
  challenge_id uuid not null
    references public.coop_challenges(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

alter table public.active_coop_challenge_participants enable row level security;

revoke all on table public.active_coop_challenge_participants
  from public, anon, authenticated;
grant all on table public.active_coop_challenge_participants
  to service_role;

delete from public.active_coop_challenge_participants;

insert into public.active_coop_challenge_participants (
  user_id,
  challenge_id,
  created_at
)
select
  participant.user_id,
  participant.challenge_id,
  participant.created_at
from (
  select
    challenge.created_by_user_id as user_id,
    challenge.id as challenge_id,
    challenge.created_at
  from public.coop_challenges as challenge
  where challenge.status = 'active'

  union all

  select
    challenge.friend_user_id,
    challenge.id,
    challenge.created_at
  from public.coop_challenges as challenge
  where challenge.status = 'active'
) as participant
order by participant.user_id::text;

create or replace function public.sync_active_coop_challenge_participants()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.active_coop_challenge_participants
    where challenge_id = old.id;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'active' then
      insert into public.active_coop_challenge_participants (
        user_id,
        challenge_id
      )
      select participant.user_id, new.id
      from (
        values (new.created_by_user_id), (new.friend_user_id)
      ) as participant(user_id)
      order by participant.user_id::text;
    end if;
    return new;
  end if;

  if old.status = 'active' and new.status <> 'active' then
    delete from public.active_coop_challenge_participants
    where challenge_id = old.id;
  elsif old.status <> 'active' and new.status = 'active' then
    insert into public.active_coop_challenge_participants (
      user_id,
      challenge_id
    )
    select participant.user_id, new.id
    from (
      values (new.created_by_user_id), (new.friend_user_id)
    ) as participant(user_id)
    order by participant.user_id::text;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_active_coop_challenge_participants()
  from public, anon, authenticated;

drop trigger if exists coop_challenges_sync_active_participants
  on public.coop_challenges;
create trigger coop_challenges_sync_active_participants
  after insert or update of status or delete on public.coop_challenges
  for each row execute function public.sync_active_coop_challenge_participants();

comment on table public.active_coop_challenge_participants is
  'Internal reservation table enforcing at most one active co-op challenge per learner.';

-- Overlapping A-B and A-C starts need user-scoped locks, not only pair-scoped
-- locks. Canonical order prevents cycles when both participants are busy.
create or replace function public.lock_social_users(
  p_user_a uuid,
  p_user_b uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_first uuid;
  v_second uuid;
begin
  if p_user_a is null or p_user_b is null or p_user_a = p_user_b then
    raise exception 'Social user locks require two different learners.' using errcode = '22023';
  end if;

  if p_user_a::text < p_user_b::text then
    v_first := p_user_a;
    v_second := p_user_b;
  else
    v_first := p_user_b;
    v_second := p_user_a;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('social-user:' || v_first::text, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('social-user:' || v_second::text, 0)
  );
end;
$$;

revoke all on function public.lock_social_users(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.lock_social_users(uuid, uuid)
  to service_role;

-- Normalize before entering the previously deployed implementation. This
-- accepts the displayed lowercase/grouped form without weakening lookup
-- failure privacy.
alter function public.send_friend_request_by_code(uuid, text)
  rename to send_friend_request_by_code_legacy;

revoke all on function public.send_friend_request_by_code_legacy(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.send_friend_request_by_code(
  p_user_id uuid,
  p_friend_code text
)
returns table (
  operation_status text,
  request_id uuid,
  target_user_id uuid,
  friendship_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_normalized_code text;
begin
  v_normalized_code := left(
    regexp_replace(
      upper(trim(coalesce(p_friend_code, ''))),
      '[^A-Z0-9]',
      '',
      'g'
    ),
    22
  );

  return query
  select
    result.operation_status,
    result.request_id,
    result.target_user_id,
    result.friendship_id
  from public.send_friend_request_by_code_legacy(
    p_user_id,
    v_normalized_code
  ) as result;
end;
$$;

revoke all on function public.send_friend_request_by_code(uuid, text)
  from public, anon, authenticated;
grant execute on function public.send_friend_request_by_code(uuid, text)
  to service_role;

-- Lock both profile parents before the request row. Profile deletion obtains
-- the same resources in that order through its foreign-key cascades.
alter function public.respond_friend_request(uuid, uuid, text)
  rename to respond_friend_request_legacy;

revoke all on function public.respond_friend_request_legacy(uuid, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.respond_friend_request(
  p_user_id uuid,
  p_request_id uuid,
  p_decision text
)
returns table (
  operation_status text,
  request_id uuid,
  peer_user_id uuid,
  request_status text,
  friendship_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_peer_user_id uuid;
  v_locked_profiles integer;
begin
  select request.from_user_id
  into v_peer_user_id
  from public.friend_requests as request
  where request.id = p_request_id
    and request.to_user_id = p_user_id;

  if not found then
    raise exception 'That friend request is not available.' using errcode = 'P0001';
  end if;

  perform profile.id
  from public.profiles as profile
  where profile.id in (p_user_id, v_peer_user_id)
  order by profile.id::text
  for key share;
  get diagnostics v_locked_profiles = row_count;

  if v_locked_profiles <> 2 then
    raise exception 'That friend request is not available.' using errcode = 'P0001';
  end if;

  return query
  select
    result.operation_status,
    result.request_id,
    result.peer_user_id,
    result.request_status,
    result.friendship_id
  from public.respond_friend_request_legacy(
    p_user_id,
    p_request_id,
    p_decision
  ) as result;
end;
$$;

revoke all on function public.respond_friend_request(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.respond_friend_request(uuid, uuid, text)
  to service_role;

alter function public.start_coop_challenge(uuid, uuid, text, integer)
  rename to start_coop_challenge_legacy;

revoke all on function public.start_coop_challenge_legacy(uuid, uuid, text, integer)
  from public, anon, authenticated, service_role;

create or replace function public.start_coop_challenge(
  p_user_id uuid,
  p_friend_user_id uuid,
  p_title text default 'Three-session co-op',
  p_target_sessions integer default 3
)
returns table (
  operation_status text,
  challenge_id uuid,
  friend_user_id uuid,
  challenge_status text,
  challenge_title text,
  target_sessions integer,
  starting_sessions jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_challenge public.coop_challenges%rowtype;
begin
  -- All pair-scoped social operations take the pair lock before touching a
  -- challenge row. Block and challenge-start requests can otherwise deadlock
  -- by waiting on the same two resources in opposite order.
  perform public.lock_social_pair(p_user_id, p_friend_user_id);
  perform public.lock_social_users(p_user_id, p_friend_user_id);

  select challenge.*
  into v_challenge
  from public.coop_challenges as challenge
  where challenge.status = 'active'
    and (
      challenge.created_by_user_id in (p_user_id, p_friend_user_id)
      or challenge.friend_user_id in (p_user_id, p_friend_user_id)
    )
  order by challenge.created_at, challenge.id
  limit 1
  for update;

  if found
    and (
      least(v_challenge.created_by_user_id::text, v_challenge.friend_user_id::text)
        <> least(p_user_id::text, p_friend_user_id::text)
      or greatest(v_challenge.created_by_user_id::text, v_challenge.friend_user_id::text)
        <> greatest(p_user_id::text, p_friend_user_id::text)
    ) then
    raise exception 'Finish your active co-op challenge before starting another.' using errcode = 'P0001';
  end if;

  return query
  select
    result.operation_status,
    result.challenge_id,
    result.friend_user_id,
    result.challenge_status,
    result.challenge_title,
    result.target_sessions,
    result.starting_sessions,
    result.created_at
  from public.start_coop_challenge_legacy(
    p_user_id,
    p_friend_user_id,
    p_title,
    p_target_sessions
  ) as result;
end;
$$;

revoke all on function public.start_coop_challenge(uuid, uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.start_coop_challenge(uuid, uuid, text, integer)
  to service_role;

comment on function public.lock_social_users(uuid, uuid) is
  'Takes canonical transaction-scoped advisory locks for two challenge participants.';
comment on function public.send_friend_request_by_code(uuid, text) is
  'Normalizes displayed friend codes before an atomic privacy-preserving lookup.';
comment on function public.respond_friend_request(uuid, uuid, text) is
  'Locks profile parents before atomically accepting or declining a friend request.';
comment on function public.start_coop_challenge(uuid, uuid, text, integer) is
  'Starts a challenge only when both learners have no other active co-op reservation.';

-- Even trusted callers cannot choose a profile's discovery secret on insert.
-- Updating the column is treated as a rotation and receives fresh database
-- randomness regardless of the supplied replacement.
create or replace function public.assign_strong_friend_code()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if tg_op = 'INSERT'
    or new.friend_code is null
    or new.friend_code !~ '^FR[A-F0-9]{20}$'
    or (tg_op = 'UPDATE' and new.friend_code is distinct from old.friend_code) then
    new.friend_code := public.random_friend_code();
  end if;
  return new;
end;
$$;

revoke all on function public.assign_strong_friend_code()
  from public, anon, authenticated;

create table if not exists public.friend_code_rotation_requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  rotated_code text not null
    check (rotated_code ~ '^FR[A-F0-9]{20}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

alter table public.friend_code_rotation_requests enable row level security;

revoke all on table public.friend_code_rotation_requests
  from public, anon, authenticated;
grant all on table public.friend_code_rotation_requests to service_role;

drop function if exists public.rotate_friend_code(uuid);

create or replace function public.rotate_friend_code(
  p_user_id uuid,
  p_request_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_rotated_code text;
begin
  if p_user_id is null or p_request_id is null then
    raise exception 'A profile and request ID are required.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'friend-code-rotation:' || p_user_id::text || ':' || p_request_id::text,
      0
    )
  );

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

revoke all on function public.rotate_friend_code(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.rotate_friend_code(uuid, uuid)
  to service_role;

comment on table public.friend_code_rotation_requests is
  'Private idempotency ledger for friend-code rotations.';
comment on function public.rotate_friend_code(uuid, uuid) is
  'Rotates a learner friend code once per caller-supplied request ID.';

-- Reuse the moderation row UUID as the idempotency key. This avoids a second
-- redundant request identifier while ensuring an HTTP retry cannot create a
-- duplicate report.
create or replace function public.report_social_user(
  p_user_id uuid,
  p_target_user_id uuid,
  p_request_id uuid,
  p_reason text,
  p_details text default null
)
returns public.social_reports
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_report public.social_reports%rowtype;
begin
  if p_user_id is null
    or p_target_user_id is null
    or p_request_id is null
    or p_user_id = p_target_user_id then
    raise exception 'You cannot report yourself.' using errcode = '22023';
  end if;

  if p_reason is null
    or p_reason not in ('spam', 'harassment', 'unsafe_content', 'other')
    or char_length(coalesce(p_details, '')) > 500 then
    raise exception 'Invalid social report.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('social-report:' || p_request_id::text, 0)
  );

  select report.*
  into v_report
  from public.social_reports as report
  where report.id = p_request_id;

  if found then
    if v_report.reporter_user_id is distinct from p_user_id
      or v_report.reported_user_id is distinct from p_target_user_id
      or v_report.reason is distinct from p_reason
      or v_report.details is distinct from p_details then
      raise exception 'Social report request ID was reused with different data.' using errcode = '22000';
    end if;
    return v_report;
  end if;

  insert into public.social_reports (
    id,
    reporter_user_id,
    reported_user_id,
    reason,
    details,
    status,
    created_at
  ) values (
    p_request_id,
    p_user_id,
    p_target_user_id,
    p_reason,
    p_details,
    'open',
    now()
  )
  returning * into v_report;

  return v_report;
end;
$$;

revoke all on function public.report_social_user(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.report_social_user(uuid, uuid, uuid, text, text)
  to service_role;

comment on function public.report_social_user(uuid, uuid, uuid, text, text) is
  'Creates one moderation report per caller-supplied row UUID and returns the original result on retry.';
