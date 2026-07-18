-- Atomic per-account quotas for paid or abuse-sensitive API actions. No
-- authenticated-client policies are created; only the service-role function
-- can read or write this operational table.
create table if not exists public.api_rate_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (char_length(action) between 1 and 60),
  request_id uuid,
  created_at timestamptz not null default now()
);

alter table public.api_rate_events
  add column if not exists request_id uuid;

create index if not exists api_rate_events_lookup_idx
  on public.api_rate_events (user_id, action, created_at desc);

create unique index if not exists api_rate_events_user_action_request_key
  on public.api_rate_events (user_id, action, request_id)
  where request_id is not null;

alter table public.api_rate_events enable row level security;
revoke all on table public.api_rate_events
  from public, anon, authenticated;
grant select, insert, delete on table public.api_rate_events
  to service_role;

drop function if exists public.consume_api_quota(uuid, text, integer, integer);

create or replace function public.consume_api_quota(
  p_user_id uuid,
  p_action text,
  p_window_seconds integer,
  p_limit integer,
  p_request_id uuid
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  cutoff timestamptz;
begin
  if p_user_id is null
    or p_action is null
    or p_window_seconds is null
    or p_limit is null
    or char_length(p_action) not between 1 and 60
    or p_window_seconds not between 1 and 604800
    or p_limit not between 1 and 10000 then
    raise exception 'Invalid API quota request.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('api-quota:' || p_user_id::text || ':' || p_action, 0)
  );

  -- Prune before the retry lookup so replaying an expired key cannot keep its
  -- operational event alive indefinitely.
  delete from public.api_rate_events
  where user_id = p_user_id
    and created_at < now() - interval '8 days';

  if p_request_id is not null and exists (
    select 1
    from public.api_rate_events
    where user_id = p_user_id
      and action = p_action
      and request_id = p_request_id
  ) then
    return true;
  end if;

  cutoff := now() - make_interval(secs => p_window_seconds);

  if (
    select count(*)
    from public.api_rate_events
    where user_id = p_user_id
      and action = p_action
      and created_at >= cutoff
  ) >= p_limit then
    return false;
  end if;

  insert into public.api_rate_events (user_id, action, request_id)
  values (p_user_id, p_action, p_request_id);

  return true;
end;
$$;

alter function public.consume_api_quota(uuid, text, integer, integer, uuid)
  owner to postgres;
revoke all on function public.consume_api_quota(uuid, text, integer, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.consume_api_quota(uuid, text, integer, integer, uuid)
  to service_role;

comment on column public.api_rate_events.request_id is
  'Optional action-scoped idempotency key supplied by a trusted server route.';
