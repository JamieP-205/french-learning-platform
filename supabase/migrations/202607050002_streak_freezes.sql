-- Earned streak freezes: a healthy streak absorbs a single missed day instead
-- of punishing normal life.

alter table public.profiles
  add column if not exists streak_freezes integer not null default 0
    check (streak_freezes between 0 and 2);
