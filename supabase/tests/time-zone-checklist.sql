-- Learner-local calendar-day checks for the supported IANA time-zone path.
-- Run after applying all migrations:
--   psql "$DATABASE_URL" -f supabase/tests/time-zone-checklist.sql

\set ON_ERROR_STOP on

begin;

do $checks$
begin
  if not public.is_valid_time_zone('Europe/London') then
    raise exception 'Europe/London should be a valid IANA time zone.';
  end if;

  if public.is_valid_time_zone('Not/A_Time_Zone') then
    raise exception 'An unknown IANA time zone should be rejected.';
  end if;

  -- The UK has entered daylight-saving time: 23:30 UTC is already the next
  -- learner-local day.
  if (
    timestamptz '2026-03-29 23:30:00+00'
      at time zone 'Europe/London'
  )::date <> date '2026-03-30' then
    raise exception 'London spring DST date conversion failed.';
  end if;

  -- New York is still on the previous local date even though UTC has crossed
  -- midnight after its spring transition.
  if (
    timestamptz '2026-03-09 03:30:00+00'
      at time zone 'America/New_York'
  )::date <> date '2026-03-08' then
    raise exception 'New York spring DST date conversion failed.';
  end if;

  -- Both UTC instants map into the repeated 01:30 hour when the UK leaves DST.
  if (
    timestamptz '2026-10-25 00:30:00+00'
      at time zone 'Europe/London'
  )::date is distinct from (
    timestamptz '2026-10-25 01:30:00+00'
      at time zone 'Europe/London'
  )::date then
    raise exception 'London autumn DST repeated hour changed calendar day.';
  end if;
end;
$checks$;

select
  public.is_valid_time_zone('UTC') as utc_is_valid,
  (
    timestamptz '2026-03-29 23:30:00+00'
      at time zone 'Europe/London'
  )::date as london_local_date,
  (
    timestamptz '2026-03-09 03:30:00+00'
      at time zone 'America/New_York'
  )::date as new_york_local_date;

rollback;
