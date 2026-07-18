-- Quota events are abuse-prevention records, not learner progress. Keep them
-- across profile deletion, but remove events once no supported quota window
-- can use them. Supabase Cron is backed by pg_cron and runs inside Postgres.

create index if not exists api_rate_events_retention_idx
  on public.api_rate_events (created_at);

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
    from cron.job
   where jobname = 'prune-expired-api-rate-events'
   limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'prune-expired-api-rate-events',
    '17 * * * *',
    $job$delete from public.api_rate_events where created_at < now() - interval '7 days'$job$
  );
end;
$$;

comment on table public.api_rate_events is
  'Short-lived abuse-prevention quota events retained for no more than approximately eight days.';
