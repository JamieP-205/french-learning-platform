-- Make onboarding idempotent and commit the profile plus required consents as
-- one transaction. The function is service-role only; callers cannot choose
-- the policy version through the public API.

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

delete from public.privacy_consents older
using public.privacy_consents newer
where older.user_id = newer.user_id
  and older.consent_type = newer.consent_type
  and older.policy_version = newer.policy_version
  and (
    older.created_at < newer.created_at
    or (older.created_at = newer.created_at and older.id < newer.id)
  );

create unique index if not exists privacy_consents_user_type_policy_key
  on public.privacy_consents (user_id, consent_type, policy_version);

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

  insert into public.privacy_consents (user_id, consent_type, policy_version, granted)
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
