-- Bind tutor responses to one completed attempt. This supports cache-first
-- explanations and prevents repeat requests from creating duplicate paid work.
alter table public.ai_interactions
  add column if not exists attempt_id uuid references public.activity_attempts(id) on delete cascade;

create unique index if not exists ai_interactions_user_attempt_key
  on public.ai_interactions (user_id, attempt_id);

create index if not exists ai_interactions_user_created_idx
  on public.ai_interactions (user_id, created_at desc);
