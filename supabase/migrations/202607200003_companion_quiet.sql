-- Whether Remy stays quiet during lessons. Off by default: he asks before
-- helping either way, and this makes even the asking optional.

alter table public.profiles
  add column if not exists companion_quiet boolean not null default false;
