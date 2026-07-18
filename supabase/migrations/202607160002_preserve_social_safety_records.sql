-- Blocks and reports are safety controls, not ordinary learner progress. Keep
-- them tied to the authenticated identity when a learner deletes and later
-- recreates their profile so deletion cannot be used to erase a block or a
-- moderation report.

alter table public.social_blocks
  drop constraint if exists social_blocks_blocker_user_id_fkey,
  drop constraint if exists social_blocks_blocked_user_id_fkey;

alter table public.social_blocks
  add constraint social_blocks_blocker_user_id_fkey
    foreign key (blocker_user_id) references auth.users(id) on delete cascade,
  add constraint social_blocks_blocked_user_id_fkey
    foreign key (blocked_user_id) references auth.users(id) on delete cascade;

alter table public.social_reports
  drop constraint if exists social_reports_reporter_user_id_fkey,
  drop constraint if exists social_reports_reported_user_id_fkey;

alter table public.social_reports
  add constraint social_reports_reporter_user_id_fkey
    foreign key (reporter_user_id) references auth.users(id) on delete cascade,
  add constraint social_reports_reported_user_id_fkey
    foreign key (reported_user_id) references auth.users(id) on delete cascade;

-- A blocked learner must not be able to enumerate who blocked them. Server
-- social checks use the service role and still evaluate both directions.
drop policy if exists "users see own blocks" on public.social_blocks;
create policy "users see blocks they created" on public.social_blocks
  for select using (blocker_user_id = auth.uid());

comment on table public.social_blocks is
  'Safety records retained across learner-profile deletion for the lifetime of the auth identity.';
comment on table public.social_reports is
  'Moderation records retained across learner-profile deletion for the lifetime of the auth identity.';
