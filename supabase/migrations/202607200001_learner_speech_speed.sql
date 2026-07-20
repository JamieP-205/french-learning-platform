-- Learners can choose how fast French audio plays, and the choice should
-- follow them across devices like every other learning preference.

alter table public.profiles
  add column if not exists speech_speed text not null default 'normal'
    check (speech_speed in ('normal', 'slow'));
