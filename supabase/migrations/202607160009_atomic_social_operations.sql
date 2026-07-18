-- Serialize every social mutation for an unordered learner pair and keep the
-- relationship state internally consistent. These RPCs are intentionally
-- service-role only: API routes authenticate the actor before supplying IDs.

-- Reconcile legacy relationship rows before enforcing canonical pair order.
-- The oldest row is the durable friendship when both historical orientations
-- exist for the same unordered pair.
with ranked_friendships as (
  select
    id,
    row_number() over (
      partition by
        least(user_one_id::text, user_two_id::text),
        greatest(user_one_id::text, user_two_id::text)
      order by created_at, id
    ) as pair_rank
  from public.friendships
)
delete from public.friendships as friendship
using ranked_friendships as ranked
where friendship.id = ranked.id
  and ranked.pair_rank > 1;

update public.friendships
set
  user_one_id = least(user_one_id::text, user_two_id::text)::uuid,
  user_two_id = greatest(user_one_id::text, user_two_id::text)::uuid
where user_one_id::text > user_two_id::text;

alter table public.friendships
  drop constraint if exists friendships_canonical_user_order;

alter table public.friendships
  add constraint friendships_canonical_user_order
    check (user_one_id::text < user_two_id::text) not valid;

alter table public.friendships
  validate constraint friendships_canonical_user_order;

-- A block wins over all ordinary social state. Apply the same cleanup once to
-- any rows written before social mutations were made transactional.
delete from public.friendships as friendship
where exists (
  select 1
  from public.social_blocks as block
  where (
    block.blocker_user_id = friendship.user_one_id
    and block.blocked_user_id = friendship.user_two_id
  ) or (
    block.blocker_user_id = friendship.user_two_id
    and block.blocked_user_id = friendship.user_one_id
  )
);

delete from public.friend_requests as request
where exists (
  select 1
  from public.social_blocks as block
  where (
    block.blocker_user_id = request.from_user_id
    and block.blocked_user_id = request.to_user_id
  ) or (
    block.blocker_user_id = request.to_user_id
    and block.blocked_user_id = request.from_user_id
  )
);

update public.coop_challenges as challenge
set
  status = 'completed',
  completed_at = coalesce(challenge.completed_at, now())
where challenge.status = 'active'
  and exists (
    select 1
    from public.social_blocks as block
    where (
      block.blocker_user_id = challenge.created_by_user_id
      and block.blocked_user_id = challenge.friend_user_id
    ) or (
      block.blocker_user_id = challenge.friend_user_id
      and block.blocked_user_id = challenge.created_by_user_id
    )
  );

-- A friendship supersedes an outstanding request for the same pair.
update public.friend_requests as request
set
  status = 'accepted',
  responded_at = coalesce(request.responded_at, now())
where request.status = 'pending'
  and exists (
    select 1
    from public.friendships as friendship
    where friendship.user_one_id = least(request.from_user_id::text, request.to_user_id::text)::uuid
      and friendship.user_two_id = greatest(request.from_user_id::text, request.to_user_id::text)::uuid
  );

-- Retain only the oldest reciprocal request as actionable. Remove duplicates
-- instead of fabricating a decline that neither learner made.
with ranked_pending_requests as (
  select
    id,
    row_number() over (
      partition by
        least(from_user_id::text, to_user_id::text),
        greatest(from_user_id::text, to_user_id::text)
      order by created_at, id
    ) as pair_rank
  from public.friend_requests
  where status = 'pending'
)
delete from public.friend_requests as request
using ranked_pending_requests as ranked
where request.id = ranked.id
  and ranked.pair_rank > 1;

update public.friend_requests
set responded_at = case
  when status = 'pending' then null
  else coalesce(responded_at, created_at, now())
end;

alter table public.friend_requests
  drop constraint if exists friend_requests_response_timestamp_matches_status;

alter table public.friend_requests
  add constraint friend_requests_response_timestamp_matches_status
    check (
      (status = 'pending' and responded_at is null)
      or (status <> 'pending' and responded_at is not null)
    ) not valid;

alter table public.friend_requests
  validate constraint friend_requests_response_timestamp_matches_status;

create unique index if not exists friend_requests_one_pending_per_pair_idx
  on public.friend_requests (
    (least(from_user_id::text, to_user_id::text)),
    (greatest(from_user_id::text, to_user_id::text))
  )
  where status = 'pending';

-- Read challenge baselines without ever casting untrusted legacy JSON. Invalid
-- values fall back to the supplied count and are repaired before the check is
-- enforced.
create or replace function public.coop_starting_session_count(
  p_starting_sessions jsonb,
  p_user_id uuid,
  p_fallback integer
)
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  raw_count text;
begin
  if jsonb_typeof(p_starting_sessions) is distinct from 'object' then
    return p_fallback;
  end if;

  raw_count := p_starting_sessions ->> p_user_id::text;
  if raw_count is null
    or raw_count !~ '^(0|[1-9][0-9]{0,9})$'
    or raw_count::numeric > 2147483647 then
    return p_fallback;
  end if;

  return raw_count::integer;
end;
$$;

revoke all on function public.coop_starting_session_count(jsonb, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.coop_starting_session_count(jsonb, uuid, integer)
  to service_role;

update public.coop_challenges as challenge
set starting_sessions = jsonb_build_object(
  challenge.created_by_user_id::text, creator.completed_sessions,
  challenge.friend_user_id::text, friend.completed_sessions
)
from public.profiles as creator, public.profiles as friend
where creator.id = challenge.created_by_user_id
  and friend.id = challenge.friend_user_id
  and (
    public.coop_starting_session_count(
      challenge.starting_sessions,
      challenge.created_by_user_id,
      -1
    ) < 0
    or public.coop_starting_session_count(
      challenge.starting_sessions,
      challenge.friend_user_id,
      -1
    ) < 0
  );

alter table public.coop_challenges
  drop constraint if exists coop_challenges_valid_starting_sessions;

alter table public.coop_challenges
  add constraint coop_challenges_valid_starting_sessions
    check (
      public.coop_starting_session_count(starting_sessions, created_by_user_id, -1) >= 0
      and public.coop_starting_session_count(starting_sessions, friend_user_id, -1) >= 0
    ) not valid;

alter table public.coop_challenges
  validate constraint coop_challenges_valid_starting_sessions;

-- Serialize completion on the active challenge row. A concurrent participant
-- waits here, then the following statement gets a fresh READ COMMITTED snapshot
-- that includes the first participant's committed session total.
create or replace function public.complete_reached_coop_challenges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform challenge.id
  from public.coop_challenges as challenge
  where challenge.status = 'active'
    and (challenge.created_by_user_id = new.id or challenge.friend_user_id = new.id)
  order by challenge.id
  for update;

  update public.coop_challenges as challenge
  set
    status = 'completed',
    completed_at = now()
  from public.profiles as creator, public.profiles as friend
  where challenge.status = 'active'
    and challenge.created_by_user_id = creator.id
    and challenge.friend_user_id = friend.id
    and (challenge.created_by_user_id = new.id or challenge.friend_user_id = new.id)
    and (
      greatest(
        0,
        creator.completed_sessions
          - public.coop_starting_session_count(
              challenge.starting_sessions,
              creator.id,
              creator.completed_sessions
            )
      )
      + greatest(
        0,
        friend.completed_sessions
          - public.coop_starting_session_count(
              challenge.starting_sessions,
              friend.id,
              friend.completed_sessions
            )
      )
    ) >= challenge.target_sessions;

  return new;
end;
$$;

revoke all on function public.complete_reached_coop_challenges()
  from public, anon, authenticated;

-- Close challenges whose target was already reached, then reconcile any
-- historical duplicate active rows before adding the unordered-pair index.
update public.coop_challenges as challenge
set
  status = 'completed',
  completed_at = coalesce(challenge.completed_at, now())
from public.profiles as creator, public.profiles as friend
where challenge.status = 'active'
  and challenge.created_by_user_id = creator.id
  and challenge.friend_user_id = friend.id
  and (
    greatest(
      0,
      creator.completed_sessions
        - public.coop_starting_session_count(challenge.starting_sessions, creator.id, creator.completed_sessions)
    )
    + greatest(
      0,
      friend.completed_sessions
        - public.coop_starting_session_count(challenge.starting_sessions, friend.id, friend.completed_sessions)
    )
  ) >= challenge.target_sessions;

with ranked_active_challenges as (
  select
    id,
    row_number() over (
      partition by
        least(created_by_user_id::text, friend_user_id::text),
        greatest(created_by_user_id::text, friend_user_id::text)
      order by created_at, id
    ) as pair_rank
  from public.coop_challenges
  where status = 'active'
)
update public.coop_challenges as challenge
set
  status = 'completed',
  completed_at = coalesce(challenge.completed_at, now())
from ranked_active_challenges as ranked
where challenge.id = ranked.id
  and ranked.pair_rank > 1;

update public.coop_challenges
set completed_at = case
  when status = 'active' then null
  else coalesce(completed_at, created_at, now())
end;

alter table public.coop_challenges
  drop constraint if exists coop_challenges_completion_timestamp_matches_status;

alter table public.coop_challenges
  add constraint coop_challenges_completion_timestamp_matches_status
    check (
      (status = 'active' and completed_at is null)
      or (status = 'completed' and completed_at is not null)
    ) not valid;

alter table public.coop_challenges
  validate constraint coop_challenges_completion_timestamp_matches_status;

create unique index if not exists coop_challenges_one_active_per_pair_idx
  on public.coop_challenges (
    (least(created_by_user_id::text, friend_user_id::text)),
    (greatest(created_by_user_id::text, friend_user_id::text))
  )
  where status = 'active';

create index if not exists social_blocks_blocked_lookup_idx
  on public.social_blocks (blocked_user_id, blocker_user_id);

create index if not exists coop_challenges_friend_status_created_idx
  on public.coop_challenges (friend_user_id, status, created_at desc);

-- Pair endpoints identify the advisory-lock domain and therefore cannot be
-- reassigned after insert. The generic trigger uses column names supplied at
-- creation, avoiding table-specific dynamic SQL.
create or replace function public.prevent_social_pair_reassignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (to_jsonb(old) ->> tg_argv[0]) is distinct from (to_jsonb(new) ->> tg_argv[0])
    or (to_jsonb(old) ->> tg_argv[1]) is distinct from (to_jsonb(new) ->> tg_argv[1]) then
    raise exception 'Social pair endpoints cannot be changed.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_social_pair_reassignment() from public, anon, authenticated;

drop trigger if exists friend_requests_keep_pair_on_update on public.friend_requests;
create trigger friend_requests_keep_pair_on_update
  before update of from_user_id, to_user_id on public.friend_requests
  for each row
  execute function public.prevent_social_pair_reassignment('from_user_id', 'to_user_id');

drop trigger if exists friendships_keep_pair_on_update on public.friendships;
create trigger friendships_keep_pair_on_update
  before update of user_one_id, user_two_id on public.friendships
  for each row
  execute function public.prevent_social_pair_reassignment('user_one_id', 'user_two_id');

drop trigger if exists coop_challenges_keep_pair_on_update on public.coop_challenges;
create trigger coop_challenges_keep_pair_on_update
  before update of created_by_user_id, friend_user_id on public.coop_challenges
  for each row
  execute function public.prevent_social_pair_reassignment('created_by_user_id', 'friend_user_id');

drop trigger if exists social_blocks_keep_pair_on_update on public.social_blocks;
create trigger social_blocks_keep_pair_on_update
  before update of blocker_user_id, blocked_user_id on public.social_blocks
  for each row
  execute function public.prevent_social_pair_reassignment('blocker_user_id', 'blocked_user_id');

-- All pair operations call this helper after resolving both users. Canonical
-- text order matches the friendships constraint and the application's UUID
-- ordering, so requests in opposite directions serialize on the same key.
create or replace function public.lock_social_pair(
  p_user_a uuid,
  p_user_b uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_a is null or p_user_b is null or p_user_a = p_user_b then
    raise exception 'A social pair requires two different learners.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'social-pair:'
        || least(p_user_a::text, p_user_b::text)
        || ':'
        || greatest(p_user_a::text, p_user_b::text),
      0
    )
  );
end;
$$;

revoke all on function public.lock_social_pair(uuid, uuid) from public, anon, authenticated;
grant execute on function public.lock_social_pair(uuid, uuid) to service_role;

-- Starting challenges for A-B and A-C must serialize even though they use
-- different pair locks. Take participant locks in one global UUID-text order
-- so overlapping starts cannot deadlock or reserve a learner twice.
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
  v_target_user_id uuid;
  v_friendship_id uuid;
  v_request public.friend_requests%rowtype;
  v_last_declined_at timestamptz;
  v_pair_blocked boolean;
begin
  if p_user_id is null then
    raise exception 'A learner ID is required.' using errcode = '22023';
  end if;

  v_normalized_code := left(
    regexp_replace(upper(trim(coalesce(p_friend_code, ''))), '[^A-Z0-9]', '', 'g'),
    22
  );

  select profile.id
  into v_target_user_id
  from public.profiles as profile
  where profile.friend_code = v_normalized_code
  for share;

  if v_target_user_id is null or v_target_user_id = p_user_id then
    raise exception 'That friend code could not be added.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.profiles as profile where profile.id = p_user_id) then
    raise exception 'Complete your profile before adding friends.' using errcode = 'P0001';
  end if;

  perform public.lock_social_pair(p_user_id, v_target_user_id);

  select exists (
    select 1
    from public.social_blocks as block
    where (
      block.blocker_user_id = p_user_id
      and block.blocked_user_id = v_target_user_id
    ) or (
      block.blocker_user_id = v_target_user_id
      and block.blocked_user_id = p_user_id
    )
  )
  into v_pair_blocked;

  if v_pair_blocked then
    raise exception 'That friend code could not be added.' using errcode = 'P0001';
  end if;

  select friendship.id
  into v_friendship_id
  from public.friendships as friendship
  where friendship.user_one_id = least(p_user_id::text, v_target_user_id::text)::uuid
    and friendship.user_two_id = greatest(p_user_id::text, v_target_user_id::text)::uuid;

  if v_friendship_id is not null then
    return query
    select 'already_friends'::text, null::uuid, v_target_user_id, v_friendship_id;
    return;
  end if;

  select request.*
  into v_request
  from public.friend_requests as request
  where request.status = 'pending'
    and least(request.from_user_id::text, request.to_user_id::text)
      = least(p_user_id::text, v_target_user_id::text)
    and greatest(request.from_user_id::text, request.to_user_id::text)
      = greatest(p_user_id::text, v_target_user_id::text)
  for update;

  if found then
    return query
    select
      case when v_request.from_user_id = p_user_id then 'already_pending' else 'reciprocal_pending' end::text,
      v_request.id,
      v_target_user_id,
      null::uuid;
    return;
  end if;

  select max(request.responded_at)
  into v_last_declined_at
  from public.friend_requests as request
  where request.status = 'declined'
    and (
      (request.from_user_id = p_user_id and request.to_user_id = v_target_user_id)
      or (request.from_user_id = v_target_user_id and request.to_user_id = p_user_id)
    );

  if v_last_declined_at is not null
    and v_last_declined_at > now() - interval '7 days' then
    raise exception 'Wait 7 days before sending another request to this learner.' using errcode = 'P0001';
  end if;

  insert into public.friend_requests (
    from_user_id,
    to_user_id,
    status,
    created_at,
    responded_at
  )
  values (
    p_user_id,
    v_target_user_id,
    'pending',
    now(),
    null
  )
  on conflict (from_user_id, to_user_id) do update
  set
    status = 'pending',
    created_at = excluded.created_at,
    responded_at = null
  returning * into v_request;

  return query
  select 'created'::text, v_request.id, v_target_user_id, null::uuid;
end;
$$;

revoke all on function public.send_friend_request_by_code(uuid, text) from public, anon, authenticated;
grant execute on function public.send_friend_request_by_code(uuid, text) to service_role;

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
  v_request public.friend_requests%rowtype;
  v_peer_user_id uuid;
  v_friendship_id uuid;
  v_pair_blocked boolean;
  v_locked_profiles integer;
begin
  if p_decision is null or p_decision not in ('accepted', 'declined') then
    raise exception 'Decision must be accepted or declined.' using errcode = '22023';
  end if;

  -- Resolve the pair, acquire its canonical lock, then re-read the request
  -- under a row lock so the pre-lock read cannot authorize a stale action.
  select request.*
  into v_request
  from public.friend_requests as request
  where request.id = p_request_id;

  if not found or v_request.to_user_id <> p_user_id then
    raise exception 'That friend request is not available.' using errcode = 'P0001';
  end if;

  v_peer_user_id := v_request.from_user_id;
  perform public.lock_social_pair(p_user_id, v_peer_user_id);

  -- Profile deletion locks the parent before cascading to this request. Match
  -- that order before taking the request row lock so acceptance cannot form a
  -- profile/request deadlock with a concurrent learner-data deletion.
  perform profile.id
  from public.profiles as profile
  where profile.id in (p_user_id, v_peer_user_id)
  order by profile.id::text
  for key share;
  get diagnostics v_locked_profiles = row_count;

  if v_locked_profiles <> 2 then
    raise exception 'That friend request is not available.' using errcode = 'P0001';
  end if;

  select request.*
  into v_request
  from public.friend_requests as request
  where request.id = p_request_id
  for update;

  if not found or v_request.to_user_id <> p_user_id then
    raise exception 'That friend request is not available.' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.social_blocks as block
    where (
      block.blocker_user_id = p_user_id
      and block.blocked_user_id = v_peer_user_id
    ) or (
      block.blocker_user_id = v_peer_user_id
      and block.blocked_user_id = p_user_id
    )
  )
  into v_pair_blocked;

  if p_decision = 'accepted' and v_pair_blocked then
    raise exception 'This learner cannot be added.' using errcode = 'P0001';
  end if;

  if v_request.status <> 'pending' then
    if v_request.status = p_decision then
      if p_decision = 'accepted' then
        select friendship.id
        into v_friendship_id
        from public.friendships as friendship
        where friendship.user_one_id = least(p_user_id::text, v_peer_user_id::text)::uuid
          and friendship.user_two_id = greatest(p_user_id::text, v_peer_user_id::text)::uuid;
      end if;

      return query
      select
        ('already_' || p_decision)::text,
        v_request.id,
        v_peer_user_id,
        v_request.status,
        v_friendship_id;
      return;
    end if;

    raise exception 'That friend request is not available.' using errcode = 'P0001';
  end if;

  update public.friend_requests as request
  set
    status = p_decision,
    responded_at = now()
  where request.id = v_request.id
  returning * into v_request;

  if p_decision = 'accepted' then
    insert into public.friendships as friendship (
      user_one_id,
      user_two_id,
      created_at
    )
    values (
      least(p_user_id::text, v_peer_user_id::text)::uuid,
      greatest(p_user_id::text, v_peer_user_id::text)::uuid,
      v_request.responded_at
    )
    on conflict (user_one_id, user_two_id) do update
    set created_at = least(friendship.created_at, excluded.created_at)
    returning friendship.id into v_friendship_id;
  end if;

  return query
  select p_decision, v_request.id, v_peer_user_id, v_request.status, v_friendship_id;
end;
$$;

revoke all on function public.respond_friend_request(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.respond_friend_request(uuid, uuid, text) to service_role;

create or replace function public.block_social_user(
  p_user_id uuid,
  p_target_user_id uuid
)
returns table (
  operation_status text,
  target_user_id uuid,
  block_created boolean,
  friendships_removed integer,
  requests_removed integer,
  challenges_closed integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_already_blocked boolean;
  v_pair_was_blocked boolean;
  v_block_rows integer := 0;
  v_friendships_removed integer := 0;
  v_requests_removed integer := 0;
  v_challenges_closed integer := 0;
begin
  if p_user_id is null or p_target_user_id is null or p_user_id = p_target_user_id then
    raise exception 'You cannot block yourself.' using errcode = '22023';
  end if;

  perform public.lock_social_pair(p_user_id, p_target_user_id);

  -- Recheck both directions under the shared pair lock. A reverse block does
  -- not prevent this learner from creating their own durable safety record.
  select
    exists (
      select 1
      from public.social_blocks as block
      where block.blocker_user_id = p_user_id
        and block.blocked_user_id = p_target_user_id
    ),
    exists (
      select 1
      from public.social_blocks as block
      where (
        block.blocker_user_id = p_user_id
        and block.blocked_user_id = p_target_user_id
      ) or (
        block.blocker_user_id = p_target_user_id
        and block.blocked_user_id = p_user_id
      )
    )
  into v_actor_already_blocked, v_pair_was_blocked;

  -- Keep reverse-block state private. It controls whether an insert is needed
  -- but is never exposed in the result.
  if not (v_pair_was_blocked and v_actor_already_blocked) then
    insert into public.social_blocks (
      blocker_user_id,
      blocked_user_id,
      created_at
    )
    values (p_user_id, p_target_user_id, now())
    on conflict (blocker_user_id, blocked_user_id) do nothing;
    get diagnostics v_block_rows = row_count;
  end if;

  delete from public.friendships as friendship
  where friendship.user_one_id = least(p_user_id::text, p_target_user_id::text)::uuid
    and friendship.user_two_id = greatest(p_user_id::text, p_target_user_id::text)::uuid;
  get diagnostics v_friendships_removed = row_count;

  delete from public.friend_requests as request
  where (request.from_user_id = p_user_id and request.to_user_id = p_target_user_id)
    or (request.from_user_id = p_target_user_id and request.to_user_id = p_user_id);
  get diagnostics v_requests_removed = row_count;

  update public.coop_challenges as challenge
  set
    status = 'completed',
    completed_at = now()
  where challenge.status = 'active'
    and least(challenge.created_by_user_id::text, challenge.friend_user_id::text)
      = least(p_user_id::text, p_target_user_id::text)
    and greatest(challenge.created_by_user_id::text, challenge.friend_user_id::text)
      = greatest(p_user_id::text, p_target_user_id::text);
  get diagnostics v_challenges_closed = row_count;

  return query
  select
    case when v_block_rows = 0 then 'already_blocked' else 'blocked' end::text,
    p_target_user_id,
    v_block_rows = 1,
    v_friendships_removed,
    v_requests_removed,
    v_challenges_closed;
end;
$$;

revoke all on function public.block_social_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.block_social_user(uuid, uuid) to service_role;

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
    hashtextextended(
      'social-report:' || p_user_id::text || ':' || p_request_id::text,
      0
    )
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
  v_user_sessions integer;
  v_friend_sessions integer;
  v_pair_blocked boolean;
  v_friendship_id uuid;
  v_title text;
begin
  if p_user_id is null or p_friend_user_id is null or p_user_id = p_friend_user_id then
    raise exception 'You cannot start a co-op challenge with yourself.' using errcode = '22023';
  end if;

  if p_target_sessions is null or p_target_sessions not between 1 and 30 then
    raise exception 'Challenge target must be between 1 and 30 sessions.' using errcode = '22023';
  end if;

  v_title := trim(coalesce(p_title, ''));
  if char_length(v_title) < 1 or char_length(v_title) > 80 then
    raise exception 'Challenge title must be between 1 and 80 characters.' using errcode = '22023';
  end if;

  perform public.lock_social_pair(p_user_id, p_friend_user_id);
  perform public.lock_social_users(p_user_id, p_friend_user_id);

  select exists (
    select 1
    from public.social_blocks as block
    where (
      block.blocker_user_id = p_user_id
      and block.blocked_user_id = p_friend_user_id
    ) or (
      block.blocker_user_id = p_friend_user_id
      and block.blocked_user_id = p_user_id
    )
  )
  into v_pair_blocked;

  if v_pair_blocked then
    raise exception 'Add this learner as a friend before starting a challenge.' using errcode = 'P0001';
  end if;

  select friendship.id
  into v_friendship_id
  from public.friendships as friendship
  where friendship.user_one_id = least(p_user_id::text, p_friend_user_id::text)::uuid
    and friendship.user_two_id = greatest(p_user_id::text, p_friend_user_id::text)::uuid;

  if v_friendship_id is null then
    raise exception 'Add this learner as a friend before starting a challenge.' using errcode = 'P0001';
  end if;

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

  if found then
    if least(v_challenge.created_by_user_id::text, v_challenge.friend_user_id::text)
        <> least(p_user_id::text, p_friend_user_id::text)
      or greatest(v_challenge.created_by_user_id::text, v_challenge.friend_user_id::text)
        <> greatest(p_user_id::text, p_friend_user_id::text) then
      raise exception 'Finish your active co-op challenge before starting another.' using errcode = 'P0001';
    end if;

    return query
    select
      'already_active'::text,
      v_challenge.id,
      p_friend_user_id,
      v_challenge.status,
      v_challenge.title,
      v_challenge.target_sessions,
      v_challenge.starting_sessions,
      v_challenge.created_at;
    return;
  end if;

  -- Prevent a session completion from landing between the baseline read and
  -- challenge insert. Canonical ordering avoids profile-row lock inversion.
  perform 1
  from public.profiles as profile
  where profile.id in (p_user_id, p_friend_user_id)
  order by profile.id::text
  for share;

  select profile.completed_sessions
  into v_user_sessions
  from public.profiles as profile
  where profile.id = p_user_id;

  select profile.completed_sessions
  into v_friend_sessions
  from public.profiles as profile
  where profile.id = p_friend_user_id;

  if v_user_sessions is null or v_friend_sessions is null then
    raise exception 'Both learners need a profile before starting a challenge.' using errcode = 'P0001';
  end if;

  insert into public.coop_challenges (
    created_by_user_id,
    friend_user_id,
    title,
    target_sessions,
    starting_sessions,
    status,
    created_at,
    completed_at
  )
  values (
    p_user_id,
    p_friend_user_id,
    v_title,
    p_target_sessions,
    jsonb_build_object(
      p_user_id::text, v_user_sessions,
      p_friend_user_id::text, v_friend_sessions
    ),
    'active',
    now(),
    null
  )
  returning * into v_challenge;

  return query
  select
    'created'::text,
    v_challenge.id,
    p_friend_user_id,
    v_challenge.status,
    v_challenge.title,
    v_challenge.target_sessions,
    v_challenge.starting_sessions,
    v_challenge.created_at;
end;
$$;

revoke all on function public.start_coop_challenge(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.start_coop_challenge(uuid, uuid, text, integer) to service_role;

comment on function public.lock_social_pair(uuid, uuid) is
  'Takes the canonical transaction-scoped advisory lock for an unordered learner pair.';
comment on function public.prevent_social_pair_reassignment() is
  'Prevents a persisted social row from moving to a different advisory-lock pair.';
comment on function public.send_friend_request_by_code(uuid, text) is
  'Atomically returns created, already_pending, reciprocal_pending, or already_friends after block and cooldown checks.';
comment on function public.respond_friend_request(uuid, uuid, text) is
  'Returns accepted, declined, already_accepted, or already_declined and creates the canonical friendship atomically.';
comment on function public.block_social_user(uuid, uuid) is
  'Returns blocked or already_blocked and atomically removes pair relationships, requests, and active challenges.';
comment on function public.start_coop_challenge(uuid, uuid, text, integer) is
  'Returns created or already_active for one unordered friend pair with a consistent progress baseline.';
