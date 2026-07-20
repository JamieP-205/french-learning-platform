-- The theme choice follows the learner across devices like every other
-- preference. "system" means follow the device.

alter table public.profiles
  add column if not exists theme_preference text not null default 'system'
    check (theme_preference in ('light', 'dark', 'system'));
