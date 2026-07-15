-- Phase E social layer: opt-in friends, safety controls, and co-op challenges.

alter table public.profiles
  add column if not exists friend_code text unique;

update public.profiles
set friend_code = 'FR' || upper(substr(replace(id::text, '-', ''), 1, 8))
where friend_code is null;

alter table public.profiles
  alter column friend_code set not null,
  add constraint profiles_friend_code_format
    check (friend_code ~ '^FR[A-Z0-9]{8}$');

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_user_id <> to_user_id),
  unique (from_user_id, to_user_id)
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_one_id uuid not null references public.profiles(id) on delete cascade,
  user_two_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_one_id <> user_two_id),
  unique (user_one_id, user_two_id)
);

create table if not exists public.social_blocks (
  blocker_user_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (blocker_user_id <> blocked_user_id),
  primary key (blocker_user_id, blocked_user_id)
);

create table if not exists public.social_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'unsafe_content', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  check (reporter_user_id <> reported_user_id)
);

create table if not exists public.coop_challenges (
  id uuid primary key default gen_random_uuid(),
  created_by_user_id uuid not null references public.profiles(id) on delete cascade,
  friend_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  target_sessions integer not null default 3 check (target_sessions between 1 and 30),
  starting_sessions jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (created_by_user_id <> friend_user_id)
);

create index if not exists friend_requests_to_user_idx on public.friend_requests (to_user_id, status, created_at desc);
create index if not exists friend_requests_from_user_idx on public.friend_requests (from_user_id, status, created_at desc);
create index if not exists friendships_user_one_idx on public.friendships (user_one_id, created_at desc);
create index if not exists friendships_user_two_idx on public.friendships (user_two_id, created_at desc);
create index if not exists coop_challenges_participants_idx on public.coop_challenges (created_by_user_id, friend_user_id, status);

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.social_blocks enable row level security;
alter table public.social_reports enable row level security;
alter table public.coop_challenges enable row level security;

create policy "users see own friend requests" on public.friend_requests
  for select using (from_user_id = auth.uid() or to_user_id = auth.uid());
create policy "users send own friend requests" on public.friend_requests
  for insert with check (from_user_id = auth.uid());
create policy "request recipients respond" on public.friend_requests
  for update using (to_user_id = auth.uid()) with check (to_user_id = auth.uid());

create policy "friends see own friendships" on public.friendships
  for select using (user_one_id = auth.uid() or user_two_id = auth.uid());
create policy "friends create own friendships" on public.friendships
  for insert with check (user_one_id = auth.uid() or user_two_id = auth.uid());
create policy "friends remove own friendships" on public.friendships
  for delete using (user_one_id = auth.uid() or user_two_id = auth.uid());

create policy "users manage own blocks" on public.social_blocks
  for all using (blocker_user_id = auth.uid()) with check (blocker_user_id = auth.uid());
create policy "users create own reports" on public.social_reports
  for insert with check (reporter_user_id = auth.uid());
create policy "users see own reports" on public.social_reports
  for select using (reporter_user_id = auth.uid());

create policy "challenge participants see challenges" on public.coop_challenges
  for select using (created_by_user_id = auth.uid() or friend_user_id = auth.uid());
create policy "challenge participants create challenges" on public.coop_challenges
  for insert with check (created_by_user_id = auth.uid());
create policy "challenge participants update challenges" on public.coop_challenges
  for update using (created_by_user_id = auth.uid() or friend_user_id = auth.uid())
  with check (created_by_user_id = auth.uid() or friend_user_id = auth.uid());
