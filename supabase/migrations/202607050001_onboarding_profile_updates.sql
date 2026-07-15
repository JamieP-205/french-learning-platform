-- Onboarding revamp: focus preferences, speaking confidence, and a 13+
-- self-declaration replace the per-country birth-date policy gate.

alter table public.profiles
  add column if not exists focus_preferences text[] not null default '{}',
  add column if not exists speaking_confidence text not null default 'medium'
    check (speaking_confidence in ('low', 'medium', 'high')),
  add column if not exists age_confirmed boolean not null default false;

-- Existing learners completed the previous birth-date flow, so they have
-- already asserted their age.
update public.profiles set age_confirmed = true where birth_date is not null;

alter table public.profiles alter column birth_date drop not null;
alter table public.profiles alter column country drop not null;

alter table public.profiles drop constraint if exists profiles_country_check;
alter table public.profiles
  add constraint profiles_country_check
  check (country is null or country = '' or country ~ '^[A-Z]{2}$');
