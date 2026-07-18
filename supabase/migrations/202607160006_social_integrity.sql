-- Strengthen friend-code discovery and make co-op completion part of the
-- persisted learner-progress transaction.

-- Expand friend codes from 32 to 80 random UUID bits. The one-time rotation
-- replaces legacy codes; existing friendships and pending requests use user
-- IDs and are unaffected.
alter table public.profiles
  drop constraint if exists profiles_friend_code_format;

with profile_codes as (
  select id, upper(replace(id::text, '-', '')) as compact_id
  from public.profiles
)
update public.profiles as profiles
set friend_code =
  'FR'
  || substr(profile_codes.compact_id, 1, 12)
  || substr(profile_codes.compact_id, 14, 3)
  || substr(profile_codes.compact_id, 18, 5)
from profile_codes
where profiles.id = profile_codes.id
  and profiles.friend_code !~ '^FR[A-F0-9]{20}$';

alter table public.profiles
  add constraint profiles_friend_code_format
    check (friend_code ~ '^FR[A-F0-9]{20}$');

comment on column public.profiles.friend_code is
  'Private 80-bit lookup code, displayed in groups of four characters.';

-- Keep a rolling deployment safe if an older application instance briefly
-- submits the legacy 8-character body after this migration is installed.
create or replace function public.assign_strong_friend_code()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  compact_id text := upper(replace(new.id::text, '-', ''));
begin
  if new.friend_code is null or new.friend_code !~ '^FR[A-F0-9]{20}$' then
    new.friend_code :=
      'FR'
      || substr(compact_id, 1, 12)
      || substr(compact_id, 14, 3)
      || substr(compact_id, 18, 5);
  end if;
  return new;
end;
$$;

revoke all on function public.assign_strong_friend_code() from public, anon, authenticated;

drop trigger if exists assign_strong_friend_code_on_profile on public.profiles;
create trigger assign_strong_friend_code_on_profile
  before insert or update of friend_code on public.profiles
  for each row
  execute function public.assign_strong_friend_code();

-- A challenge target is shared: each participant contributes sessions
-- completed after the challenge started. Complete it immediately when either
-- profile update takes the pair to the target.
create or replace function public.complete_reached_coop_challenges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
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
          - coalesce((challenge.starting_sessions ->> creator.id::text)::integer, creator.completed_sessions)
      )
      + greatest(
        0,
        friend.completed_sessions
          - coalesce((challenge.starting_sessions ->> friend.id::text)::integer, friend.completed_sessions)
      )
    ) >= challenge.target_sessions;

  return new;
end;
$$;

revoke all on function public.complete_reached_coop_challenges() from public, anon, authenticated;

drop trigger if exists complete_reached_coop_challenges_on_profile on public.profiles;
create trigger complete_reached_coop_challenges_on_profile
  after update of completed_sessions on public.profiles
  for each row
  when (new.completed_sessions > old.completed_sessions)
  execute function public.complete_reached_coop_challenges();
