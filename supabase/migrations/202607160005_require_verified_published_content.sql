-- Publishing is a provenance claim. Prevent new or edited rows from being
-- learner-visible unless they have completed source validation.
alter table public.content_items
  add constraint published_content_must_be_source_validated
  check (
    publication_status <> 'published'
    or verification_status = 'source_validated'
  );
