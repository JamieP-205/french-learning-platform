-- Editorial version history is not learner progress. Keep the immutable
-- content record if an authorised editor later removes their auth account,
-- while dropping the account identifier automatically.

alter table public.content_versions
  drop constraint if exists content_versions_created_by_fkey;

alter table public.content_versions
  add constraint content_versions_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null;

comment on column public.content_versions.created_by is
  'Restricted editorial attribution. Retained with content history after learner-data deletion and anonymised if the auth account is deleted.';
