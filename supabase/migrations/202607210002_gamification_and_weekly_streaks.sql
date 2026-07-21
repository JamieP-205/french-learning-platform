-- Two healthy-motivation controls from the evidence base: gamification that
-- can be turned down or off without touching learning, and a weekly streak
-- cadence so weekend-only learners are not punished by a daily clock.

alter table public.profiles
  add column if not exists gamification text not null default 'full'
    check (gamification in ('full', 'quiet', 'off')),
  add column if not exists streak_mode text not null default 'daily'
    check (streak_mode in ('daily', 'weekly'));

-- Same reviewed streak logic, now cadence-aware: in weekly mode the gap is
-- measured in Monday-start calendar weeks (in the learner's time zone), and
-- freezes absorb a single missed week exactly as they absorb a missed day.
create or replace function public.apply_profile_local_streak()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date;
  v_previous_day date;
  v_unit_gap integer;
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

    if new.streak_mode = 'weekly' then
      v_unit_gap := (date_trunc('week', v_today)::date - date_trunc('week', v_previous_day)::date) / 7;
    else
      v_unit_gap := v_today - v_previous_day;
    end if;

    if v_unit_gap <= 0 then
      null;
    elsif v_unit_gap = 1 then
      v_new_streak := v_new_streak + 1;
      if mod(v_new_streak, 7) = 0 and v_new_freezes < 2 then
        v_new_freezes := v_new_freezes + 1;
      end if;
    elsif v_unit_gap = 2 and v_new_freezes > 0 then
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
