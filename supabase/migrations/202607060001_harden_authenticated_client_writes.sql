-- Public deploy hardening: authenticated browser clients may read scoped data,
-- but learner-state and social mutations must go through server routes that use
-- the service role. This prevents direct PostgREST writes from forging progress,
-- friend links, reports, blocks, or co-op challenge state.

drop policy if exists "users create own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "users write own consents" on public.privacy_consents;

drop policy if exists "users own sessions" on public.sessions;
drop policy if exists "users read own sessions" on public.sessions;
create policy "users read own sessions" on public.sessions
  for select using (user_id = auth.uid());

drop policy if exists "users own attempts" on public.activity_attempts;
drop policy if exists "users read own attempts" on public.activity_attempts;
create policy "users read own attempts" on public.activity_attempts
  for select using (user_id = auth.uid());

drop policy if exists "users own mistake events" on public.mistake_events;
drop policy if exists "users read own mistake events" on public.mistake_events;
create policy "users read own mistake events" on public.mistake_events
  for select using (user_id = auth.uid());

drop policy if exists "users own mistake patterns" on public.mistake_patterns;
drop policy if exists "users read own mistake patterns" on public.mistake_patterns;
create policy "users read own mistake patterns" on public.mistake_patterns
  for select using (user_id = auth.uid());

drop policy if exists "users own review items" on public.review_items;
drop policy if exists "users read own review items" on public.review_items;
create policy "users read own review items" on public.review_items
  for select using (user_id = auth.uid());

drop policy if exists "users own streak events" on public.streak_events;
drop policy if exists "users read own streak events" on public.streak_events;
create policy "users read own streak events" on public.streak_events
  for select using (user_id = auth.uid());

drop policy if exists "users own rewards" on public.rewards;
drop policy if exists "users read own rewards" on public.rewards;
create policy "users read own rewards" on public.rewards
  for select using (user_id = auth.uid());

drop policy if exists "users own ai summaries" on public.ai_session_summaries;
drop policy if exists "users read own ai summaries" on public.ai_session_summaries;
create policy "users read own ai summaries" on public.ai_session_summaries
  for select using (user_id = auth.uid());

drop policy if exists "users own ai interactions" on public.ai_interactions;
drop policy if exists "users read own ai interactions" on public.ai_interactions;
create policy "users read own ai interactions" on public.ai_interactions
  for select using (user_id = auth.uid());

drop policy if exists "users send own friend requests" on public.friend_requests;
drop policy if exists "request recipients respond" on public.friend_requests;

drop policy if exists "friends create own friendships" on public.friendships;
drop policy if exists "friends remove own friendships" on public.friendships;

drop policy if exists "users manage own blocks" on public.social_blocks;
drop policy if exists "users see own blocks" on public.social_blocks;
create policy "users see own blocks" on public.social_blocks
  for select using (blocker_user_id = auth.uid() or blocked_user_id = auth.uid());

drop policy if exists "users create own reports" on public.social_reports;

drop policy if exists "challenge participants create challenges" on public.coop_challenges;
drop policy if exists "challenge participants update challenges" on public.coop_challenges;
