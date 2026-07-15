-- Completion and correctness are distinct: a learner can complete an honest
-- self-check without creating scored learning evidence.
alter table public.activity_attempts
  add column if not exists completed boolean not null default true,
  add column if not exists evidence_kind text;

alter table public.activity_attempts
  drop constraint if exists activity_attempts_evidence_kind_check;

alter table public.activity_attempts
  add constraint activity_attempts_evidence_kind_check
  check (evidence_kind in ('recognition', 'controlled', 'free-production', 'self-report'));

-- Every legacy speech placeholder submitted the literal accepted answer
-- "completed", regardless of recognition outcome. Reclassify that historical
-- evidence instead of preserving known false positives. Other legacy rows keep
-- evidence_kind null because their evidence category was not recorded.
update public.activity_attempts as attempt
set evidence_kind = 'self-report',
    is_correct = false,
    result_json = jsonb_set(
      jsonb_set(attempt.result_json, '{isCorrect}', 'false'::jsonb),
      '{shouldCreateReview}',
      'false'::jsonb
    )
from public.activities as activity
where activity.id = attempt.activity_id
  and activity.payload ->> 'type' = 'speak_repeat_placeholder'
  and attempt.submitted_answer = 'completed';
