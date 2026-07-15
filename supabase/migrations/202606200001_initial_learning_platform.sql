-- French for Life: source-of-truth content and learner-state foundation.
create extension if not exists pgcrypto;

create type public.content_verification_status as enum ('draft', 'source_validated', 'generated_unverified', 'needs_review', 'deprecated');
create type public.publication_status as enum ('draft', 'published', 'deprecated');
create type public.register_label as enum ('formal', 'neutral', 'casual', 'slang', 'regional');

create table public.country_age_policies (
  country_code text primary key check (country_code ~ '^[A-Z]{2}$'),
  minimum_age integer not null check (minimum_age between 13 and 18),
  policy_version text not null,
  approved boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  current_level text not null default 'A1',
  learning_goals text[] not null default '{}',
  interests text[] not null default '{}',
  daily_minutes integer not null default 8 check (daily_minutes between 2 and 60),
  preferred_mode text not null default 'normal' check (preferred_mode in ('normal', 'short')),
  country text not null check (country ~ '^[A-Z]{2}$'),
  birth_date date not null,
  policy_version text not null,
  last_completed_at timestamptz,
  completed_sessions integer not null default 0,
  current_streak integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.privacy_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null check (consent_type in ('terms', 'privacy', 'ai_tutor', 'marketing')),
  policy_version text not null,
  granted boolean not null,
  created_at timestamptz not null default now()
);

create table public.content_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  reference text not null,
  licence_notes text,
  trust_level text not null check (trust_level in ('primary', 'editorial', 'reference')),
  created_at timestamptz not null default now()
);

create table public.content_items (
  id text primary key,
  item_type text not null check (item_type in ('phrase', 'grammar', 'dialogue', 'pronunciation_target')),
  french_text text not null,
  english_meaning text not null,
  literal_meaning text,
  register register_label not null,
  usage_context text not null,
  cefr_level text not null,
  grammar_tags text[] not null default '{}',
  source_ids uuid[] not null default '{}',
  verification_status content_verification_status not null,
  publication_status publication_status not null default 'draft',
  reviewer_notes text,
  current_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_item_id text not null references public.content_items(id) on delete cascade,
  version integer not null,
  payload jsonb not null,
  source_ids uuid[] not null default '{}',
  verification_status content_verification_status not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (content_item_id, version)
);

create table public.missions (
  id text primary key,
  slug text not null unique,
  title text not null,
  description text not null,
  outcome text not null,
  estimated_minutes integer not null check (estimated_minutes between 1 and 60),
  cefr_level text not null,
  publication_status publication_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id text primary key,
  mission_id text not null references public.missions(id) on delete cascade,
  step_order integer not null,
  activity_type text not null check (activity_type in ('multiple_choice', 'fill_blank', 'typing', 'sentence_builder', 'dictation_placeholder', 'speak_repeat_placeholder')),
  payload jsonb not null,
  publication_status publication_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mission_id, step_order)
);

create table public.activity_content_links (
  activity_id text not null references public.activities(id) on delete cascade,
  content_item_id text not null references public.content_items(id) on delete restrict,
  primary key (activity_id, content_item_id)
);

create table public.accepted_answer_sets (
  id uuid primary key default gen_random_uuid(),
  activity_id text not null unique references public.activities(id) on delete cascade,
  canonical_answer text not null,
  valid_variants jsonb not null,
  invalid_near_misses jsonb not null default '[]'::jsonb,
  tolerance_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_id text not null references public.missions(id),
  plan_json jsonb not null,
  mode text not null check (mode in ('normal', 'two_minute', 'comeback')),
  started_at timestamptz not null,
  completed_at timestamptz,
  current_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.activity_attempts (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  activity_id text not null references public.activities(id),
  submitted_answer text not null,
  latency_ms integer not null check (latency_ms >= 0),
  result_json jsonb not null,
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

create table public.mistake_events (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  activity_id text references public.activities(id) on delete set null,
  content_item_id text references public.content_items(id) on delete set null,
  rule_id text not null,
  submitted_answer text not null,
  corrected_answer text not null,
  mistake_type text not null,
  explanation text not null,
  created_at timestamptz not null default now()
);

create table public.mistake_patterns (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rule_id text not null,
  mistake_type text not null,
  corrected_answer text not null,
  explanation text not null,
  repeat_count integer not null default 1,
  separate_production_successes integer not null default 0,
  resolved boolean not null default false,
  last_seen_at timestamptz not null default now(),
  unique (user_id, rule_id)
);

create table public.review_items (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content_item_id text not null references public.content_items(id),
  activity_id text not null references public.activities(id),
  rule_id text,
  prompt text not null,
  expected_answers jsonb not null,
  stage integer not null default 0 check (stage between 0 and 4),
  due_at timestamptz not null,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, content_item_id, rule_id)
);

create table public.streak_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default now()
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_key text not null,
  earned_at timestamptz not null default now(),
  unique (user_id, reward_key)
);

create table public.ai_session_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  summary jsonb not null,
  created_at timestamptz not null default now()
);

create table public.ai_interactions (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  interaction_type text not null,
  context_pack_summary jsonb not null,
  response_summary jsonb not null,
  provider text not null,
  created_at timestamptz not null default now()
);

create index review_items_due_idx on public.review_items (user_id, due_at, priority desc);
create index activity_attempts_user_created_idx on public.activity_attempts (user_id, created_at desc);
create index mistake_patterns_user_open_idx on public.mistake_patterns (user_id, resolved, repeat_count desc);

create or replace function public.is_content_owner()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('content_owner', 'admin');
$$;

alter table public.country_age_policies enable row level security;
alter table public.profiles enable row level security;
alter table public.privacy_consents enable row level security;
alter table public.content_sources enable row level security;
alter table public.content_items enable row level security;
alter table public.content_versions enable row level security;
alter table public.missions enable row level security;
alter table public.activities enable row level security;
alter table public.activity_content_links enable row level security;
alter table public.accepted_answer_sets enable row level security;
alter table public.sessions enable row level security;
alter table public.activity_attempts enable row level security;
alter table public.mistake_events enable row level security;
alter table public.mistake_patterns enable row level security;
alter table public.review_items enable row level security;
alter table public.streak_events enable row level security;
alter table public.rewards enable row level security;
alter table public.ai_session_summaries enable row level security;
alter table public.ai_interactions enable row level security;

create policy "approved age policies are readable" on public.country_age_policies for select using (approved);
create policy "users read own profile" on public.profiles for select using (id = auth.uid());
create policy "users create own profile" on public.profiles for insert with check (id = auth.uid());
create policy "users update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "users read own consents" on public.privacy_consents for select using (user_id = auth.uid());
create policy "users write own consents" on public.privacy_consents for insert with check (user_id = auth.uid());

create policy "published sources readable" on public.content_sources for select using (true);
create policy "published content readable" on public.content_items for select using (publication_status = 'published');
create policy "published missions readable" on public.missions for select using (publication_status = 'published');
create policy "published activities readable" on public.activities for select using (publication_status = 'published');
create policy "published activity links readable" on public.activity_content_links for select using (true);
create policy "published answer sets readable" on public.accepted_answer_sets for select using (true);
create policy "owners manage content sources" on public.content_sources for all using (public.is_content_owner()) with check (public.is_content_owner());
create policy "owners manage content items" on public.content_items for all using (public.is_content_owner()) with check (public.is_content_owner());
create policy "owners manage content versions" on public.content_versions for all using (public.is_content_owner()) with check (public.is_content_owner());
create policy "owners manage missions" on public.missions for all using (public.is_content_owner()) with check (public.is_content_owner());
create policy "owners manage activities" on public.activities for all using (public.is_content_owner()) with check (public.is_content_owner());
create policy "owners manage activity links" on public.activity_content_links for all using (public.is_content_owner()) with check (public.is_content_owner());
create policy "owners manage answer sets" on public.accepted_answer_sets for all using (public.is_content_owner()) with check (public.is_content_owner());

create policy "users own sessions" on public.sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users own attempts" on public.activity_attempts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users own mistake events" on public.mistake_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users own mistake patterns" on public.mistake_patterns for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users own review items" on public.review_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users own streak events" on public.streak_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users own rewards" on public.rewards for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users own ai summaries" on public.ai_session_summaries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users own ai interactions" on public.ai_interactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
