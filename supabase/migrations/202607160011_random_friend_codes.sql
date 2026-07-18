-- Friend codes must be independent secrets, not a reversible or
-- reconstructible projection of the auth UUID. Rotate all existing codes and
-- generate future values from PostgreSQL cryptographic randomness.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.random_friend_code()
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  candidate text;
begin
  loop
    candidate := 'FR' || upper(encode(extensions.gen_random_bytes(10), 'hex'));
    exit when not exists (
      select 1 from public.profiles where friend_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

revoke all on function public.random_friend_code() from public, anon, authenticated;
grant execute on function public.random_friend_code() to service_role;

-- A collision across 80 random bits is extraordinarily unlikely; the unique
-- constraint still makes any collision fail closed.
update public.profiles
set friend_code = public.random_friend_code();

create or replace function public.assign_strong_friend_code()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if tg_op = 'INSERT'
    or new.friend_code is null
    or new.friend_code !~ '^FR[A-F0-9]{20}$'
    or (tg_op = 'UPDATE' and new.friend_code is distinct from old.friend_code) then
    new.friend_code := public.random_friend_code();
  end if;
  return new;
end;
$$;

revoke all on function public.assign_strong_friend_code() from public, anon, authenticated;

-- Record the result of each logical rotation so a transport retry cannot
-- rotate a code twice and return a value that is already obsolete.
create table if not exists public.friend_code_rotation_requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  rotated_code text not null
    check (rotated_code ~ '^FR[A-F0-9]{20}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

alter table public.friend_code_rotation_requests enable row level security;

revoke all on table public.friend_code_rotation_requests
  from public, anon, authenticated;
grant all on table public.friend_code_rotation_requests to service_role;

drop function if exists public.rotate_friend_code(uuid);

create or replace function public.rotate_friend_code(
  p_user_id uuid,
  p_request_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  rotated_code text;
begin
  if p_user_id is null or p_request_id is null then
    raise exception 'A profile and request ID are required.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'friend-code-rotation:' || p_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select request.rotated_code
    into rotated_code
  from public.friend_code_rotation_requests as request
  where request.user_id = p_user_id
    and request.request_id = p_request_id;

  if found then
    return rotated_code;
  end if;

  update public.profiles
     set
       friend_code = public.random_friend_code(),
       updated_at = now()
   where id = p_user_id
  returning friend_code into rotated_code;

  if rotated_code is null then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  insert into public.friend_code_rotation_requests (
    user_id,
    request_id,
    rotated_code
  ) values (
    p_user_id,
    p_request_id,
    rotated_code
  );

  return rotated_code;
end;
$$;

revoke all on function public.rotate_friend_code(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.rotate_friend_code(uuid, uuid)
  to service_role;

comment on table public.friend_code_rotation_requests is
  'Private idempotency ledger for friend-code rotations.';
comment on function public.rotate_friend_code(uuid, uuid) is
  'Rotates a learner friend code once per caller-supplied request ID.';

comment on column public.profiles.friend_code is
  'Rotatable private 80-bit random lookup code, independent of the auth user ID.';
