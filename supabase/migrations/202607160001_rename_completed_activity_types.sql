-- Dictation and speaking practice are implemented activities now. Remove the
-- old placeholder names without losing existing authored payloads.
alter table public.activities
  drop constraint if exists activities_activity_type_check;

update public.activities
set activity_type = case activity_type
      when 'dictation_placeholder' then 'dictation'
      when 'speak_repeat_placeholder' then 'speak_repeat'
      else activity_type
    end,
    payload = case payload ->> 'type'
      when 'dictation_placeholder' then jsonb_set(payload, '{type}', '"dictation"'::jsonb)
      when 'speak_repeat_placeholder' then jsonb_set(payload, '{type}', '"speak_repeat"'::jsonb)
      else payload
    end
where activity_type in ('dictation_placeholder', 'speak_repeat_placeholder')
   or payload ->> 'type' in ('dictation_placeholder', 'speak_repeat_placeholder');

alter table public.activities
  add constraint activities_activity_type_check
  check (activity_type in (
    'multiple_choice',
    'fill_blank',
    'typing',
    'sentence_builder',
    'dictation',
    'speak_repeat'
  ));
