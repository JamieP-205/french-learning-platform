-- French for Life: reviewed starter mission seed.
-- Run only after every file in supabase/migrations has been applied in filename
-- order. This publishes the source-backed A1 starter mission; generated or
-- unreviewed material belongs in draft.

insert into public.content_sources (id, title, reference, licence_notes, trust_level)
values (
  '00000000-0000-0000-0000-000000000001',
  'Source-backed beginner French reference set',
  'Content-owner source record: A1 introductions and avoir for age',
  'Approved for the first verified mission only. Add a reviewed provenance record before expanding the curriculum.',
  'reference'
)
on conflict (id) do update set
  title = excluded.title,
  reference = excluded.reference,
  licence_notes = excluded.licence_notes,
  trust_level = excluded.trust_level;

insert into public.content_items (
  id, item_type, french_text, english_meaning, literal_meaning, register,
  usage_context, cefr_level, grammar_tags, source_ids, verification_status,
  publication_status, reviewer_notes, current_version
)
values
  ('phrase-je-mappelle-v1', 'phrase', 'Je m''appelle...', 'My name is...', 'I call myself...', 'neutral', 'A safe everyday introduction.', 'A1', array['s''appeler', 'introduction'], array['00000000-0000-0000-0000-000000000001']::uuid[], 'source_validated', 'published', 'Neutral default for first introductions.', 1),
  ('phrase-moi-cest-v1', 'phrase', 'Moi, c''est...', 'I''m... / My name is...', null, 'casual', 'A relaxed spoken introduction with friends or peers.', 'A1', array['introduction', 'spoken-register'], array['00000000-0000-0000-0000-000000000001']::uuid[], 'source_validated', 'published', 'Teach as casual rather than as the universal default.', 1),
  ('rule-age-avoir-v1', 'grammar', 'J''ai 20 ans.', 'I am 20 years old.', 'I have 20 years.', 'neutral', 'Use avoir, not être, when stating age.', 'A1', array['avoir', 'age'], array['00000000-0000-0000-0000-000000000001']::uuid[], 'source_validated', 'published', 'Configured near miss: Je suis 20 ans.', 1),
  ('phrase-je-viens-de-v1', 'phrase', 'Je viens de Belfast.', 'I come from Belfast.', null, 'neutral', 'Use this to say where you come from.', 'A1', array['venir de', 'origin'], array['00000000-0000-0000-0000-000000000001']::uuid[], 'source_validated', 'published', null, 1),
  ('phrase-aujourdhui-v1', 'phrase', 'Aujourd''hui, j''étudie le français.', 'Today, I am studying French.', null, 'neutral', 'A short everyday sentence about what you are doing today.', 'A1', array['aujourd''hui', 'étudier'], array['00000000-0000-0000-0000-000000000001']::uuid[], 'source_validated', 'published', 'Speaking step is completion-only: no recording or scoring is stored.', 1)
on conflict (id) do update set
  item_type = excluded.item_type,
  french_text = excluded.french_text,
  english_meaning = excluded.english_meaning,
  literal_meaning = excluded.literal_meaning,
  register = excluded.register,
  usage_context = excluded.usage_context,
  cefr_level = excluded.cefr_level,
  grammar_tags = excluded.grammar_tags,
  source_ids = excluded.source_ids,
  verification_status = excluded.verification_status,
  publication_status = excluded.publication_status,
  reviewer_notes = excluded.reviewer_notes,
  current_version = excluded.current_version;

insert into public.content_versions (content_item_id, version, payload, source_ids, verification_status)
select
  id,
  current_version,
  jsonb_build_object(
    'frenchText', french_text,
    'englishMeaning', english_meaning,
    'literalMeaning', literal_meaning,
    'register', register,
    'usageContext', usage_context,
    'grammarTags', grammar_tags,
    'reviewerNotes', reviewer_notes
  ),
  source_ids,
  verification_status
from public.content_items
where id in ('phrase-je-mappelle-v1', 'phrase-moi-cest-v1', 'rule-age-avoir-v1', 'phrase-je-viens-de-v1', 'phrase-aujourdhui-v1')
on conflict (content_item_id, version) do update set
  payload = excluded.payload,
  source_ids = excluded.source_ids,
  verification_status = excluded.verification_status;

insert into public.missions (id, slug, title, description, outcome, estimated_minutes, cefr_level, publication_status)
values (
  'mission-introduce-yourself-v1',
  'introduce-yourself',
  'Introduce yourself and talk about your day',
  'Build a short, natural introduction you can use with someone new.',
  'Say your name, age, origin, and one thing you do in everyday French.',
  10,
  'A1',
  'published'
)
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  description = excluded.description,
  outcome = excluded.outcome,
  estimated_minutes = excluded.estimated_minutes,
  cefr_level = excluded.cefr_level,
  publication_status = excluded.publication_status;

insert into public.activities (id, mission_id, step_order, activity_type, payload, publication_status)
values
  ('act-name-meaning-v1', 'mission-introduce-yourself-v1', 1, 'multiple_choice', $json$
    {"id":"act-name-meaning-v1","type":"multiple_choice","prompt":"What does \"Je m'appelle Jamie\" mean?","promptFrenchSegments":["Je m'appelle Jamie"],"helperText":"Choose the everyday meaning.","contentItemIds":["phrase-je-mappelle-v1"],"grammarRuleIds":[],"estimatedSeconds":25,"choices":[{"id":"a","label":"My name is Jamie.","language":"en"},{"id":"b","label":"I am from Jamie.","language":"en"},{"id":"c","label":"I like Jamie.","language":"en"}],"acceptedAnswers":[{"value":"a"}],"feedbackCorrect":"Exactly. This is a neutral, safe everyday introduction.","feedbackIncorrect":"Use \"Je m'appelle...\" to say your name."}
  $json$::jsonb, 'published'),
  ('act-age-fill-v1', 'mission-introduce-yourself-v1', 2, 'fill_blank', $json$
    {"id":"act-age-fill-v1","type":"fill_blank","prompt":"Fill the gap: J'___ 20 ans.","promptFrenchSegments":["J'___ 20 ans."],"helperText":"French uses a verb meaning \"to have\" for age.","placeholder":"Type one word","contentItemIds":["rule-age-avoir-v1"],"grammarRuleIds":["rule-age-avoir-v1"],"estimatedSeconds":25,"acceptedAnswers":[{"value":"ai","allowAccentless":true}],"nearMisses":[{"value":"suis","mistakeType":"grammar","ruleId":"rule-age-avoir-v1","explanation":"French uses avoir for age, not être.","correctedAnswer":"J'ai 20 ans."}],"feedbackCorrect":"Yes—J'ai 20 ans is the standard pattern.","feedbackIncorrect":"For age, French uses avoir: J'ai 20 ans."}
  $json$::jsonb, 'published'),
  ('act-age-typing-v1', 'mission-introduce-yourself-v1', 3, 'typing', $json$
    {"id":"act-age-typing-v1","type":"typing","prompt":"Write: I am 20 years old.","promptFrenchSegments":[],"helperText":"Use the complete French sentence.","placeholder":"Write your answer in French","contentItemIds":["rule-age-avoir-v1"],"grammarRuleIds":["rule-age-avoir-v1"],"estimatedSeconds":35,"acceptedAnswers":[{"value":"J'ai 20 ans"}],"nearMisses":[{"value":"Je suis 20 ans","mistakeType":"grammar","ruleId":"rule-age-avoir-v1","explanation":"French uses avoir for age, not être.","correctedAnswer":"J'ai 20 ans."}],"feedbackCorrect":"Great recall. French literally says \"I have 20 years.\"","feedbackIncorrect":"Use avoir for age: J'ai 20 ans."}
  $json$::jsonb, 'published'),
  ('act-origin-builder-v1', 'mission-introduce-yourself-v1', 4, 'sentence_builder', $json$
    {"id":"act-origin-builder-v1","type":"sentence_builder","prompt":"Put the words in order: I come from Belfast.","promptFrenchSegments":[],"helperText":"Tap the words in their French order.","tokens":["Je","viens","de","Belfast"],"contentItemIds":["phrase-je-viens-de-v1"],"grammarRuleIds":["phrase-je-viens-de-v1"],"estimatedSeconds":35,"acceptedAnswers":[{"value":"Je viens de Belfast"}],"feedbackCorrect":"Well built. Use venir de for where you come from.","feedbackIncorrect":"The safe pattern is: Je viens de Belfast."}
  $json$::jsonb, 'published'),
  ('act-dictation-v1', 'mission-introduce-yourself-v1', 5, 'dictation', $json$
    {"id":"act-dictation-v1","type":"dictation","prompt":"Dictation practice: type the phrase you hear.","promptFrenchSegments":[],"helperText":"Play the audio, then type what you hear.","targetText":"Je m'appelle Jamie.","placeholder":"Type the phrase","contentItemIds":["phrase-je-mappelle-v1"],"grammarRuleIds":[],"estimatedSeconds":40,"acceptedAnswers":[{"value":"Je m'appelle Jamie"}],"feedbackCorrect":"Nice. You matched the sounds to the words.","feedbackIncorrect":"The target phrase is: Je m'appelle Jamie."}
  $json$::jsonb, 'published'),
  ('act-speak-repeat-v1', 'mission-introduce-yourself-v1', 6, 'speak_repeat', $json$
    {"id":"act-speak-repeat-v1","type":"speak_repeat","prompt":"Say this out loud: Aujourd'hui, j'étudie le français.","promptFrenchSegments":["Aujourd'hui, j'étudie le français."],"helperText":"This is a speaking self-check. No recording, transcription, or pronunciation score is used.","targetText":"Aujourd'hui, j'étudie le français.","contentItemIds":["phrase-aujourdhui-v1"],"grammarRuleIds":[],"estimatedSeconds":30,"acceptedAnswers":[{"value":"completed"}],"feedbackCorrect":"Good work. Notice the rhythm: aujourd'hui | j'étudie | le français.","feedbackIncorrect":"Try the phrase once more at a comfortable pace."}
  $json$::jsonb, 'published'),
  ('act-register-v1', 'mission-introduce-yourself-v1', 7, 'multiple_choice', $json$
    {"id":"act-register-v1","type":"multiple_choice","prompt":"Which version is more casual in a relaxed spoken introduction?","promptFrenchSegments":[],"helperText":"Both can be useful—choose the relaxed spoken option.","contentItemIds":["phrase-je-mappelle-v1","phrase-moi-cest-v1"],"grammarRuleIds":[],"estimatedSeconds":25,"choices":[{"id":"a","label":"Je m'appelle Jamie.","language":"fr"},{"id":"b","label":"Moi, c'est Jamie.","language":"fr"}],"acceptedAnswers":[{"value":"b","register":"casual"}],"feedbackCorrect":"Right. \"Moi, c'est...\" is a relaxed spoken option; \"Je m'appelle...\" is the safer neutral default.","feedbackIncorrect":"\"Je m'appelle...\" is neutral. \"Moi, c'est...\" is more casual and spoken."}
  $json$::jsonb, 'published')
on conflict (id) do update set
  mission_id = excluded.mission_id,
  step_order = excluded.step_order,
  activity_type = excluded.activity_type,
  payload = excluded.payload,
  publication_status = excluded.publication_status;

insert into public.activity_content_links (activity_id, content_item_id)
values
  ('act-name-meaning-v1', 'phrase-je-mappelle-v1'),
  ('act-age-fill-v1', 'rule-age-avoir-v1'),
  ('act-age-typing-v1', 'rule-age-avoir-v1'),
  ('act-origin-builder-v1', 'phrase-je-viens-de-v1'),
  ('act-dictation-v1', 'phrase-je-mappelle-v1'),
  ('act-speak-repeat-v1', 'phrase-aujourdhui-v1'),
  ('act-register-v1', 'phrase-je-mappelle-v1'),
  ('act-register-v1', 'phrase-moi-cest-v1')
on conflict do nothing;

insert into public.accepted_answer_sets (activity_id, canonical_answer, valid_variants, invalid_near_misses, tolerance_rules)
values
  ('act-name-meaning-v1', 'a', '[{"value":"a"}]', '[]', '{}'),
  ('act-age-fill-v1', 'ai', '[{"value":"ai","allowAccentless":true}]', '[{"value":"suis","mistakeType":"grammar","ruleId":"rule-age-avoir-v1","correctedAnswer":"J''ai 20 ans."}]', '{"normalization":"case, punctuation, whitespace, configured accent variants"}'),
  ('act-age-typing-v1', 'J''ai 20 ans', '[{"value":"J''ai 20 ans"}]', '[{"value":"Je suis 20 ans","mistakeType":"grammar","ruleId":"rule-age-avoir-v1","correctedAnswer":"J''ai 20 ans."}]', '{"normalization":"case, punctuation, whitespace"}'),
  ('act-origin-builder-v1', 'Je viens de Belfast', '[{"value":"Je viens de Belfast"}]', '[]', '{"normalization":"case, punctuation, whitespace"}'),
  ('act-dictation-v1', 'Je m''appelle Jamie', '[{"value":"Je m''appelle Jamie"}]', '[]', '{"normalization":"case, punctuation, whitespace"}'),
  ('act-speak-repeat-v1', 'completed', '[{"value":"completed"}]', '[]', '{"no_audio_storage":true}'),
  ('act-register-v1', 'b', '[{"value":"b","register":"casual"}]', '[]', '{"register":"casual only"}')
on conflict (activity_id) do update set
  canonical_answer = excluded.canonical_answer,
  valid_variants = excluded.valid_variants,
  invalid_near_misses = excluded.invalid_near_misses,
  tolerance_rules = excluded.tolerance_rules;

-- Do not insert country_age_policies here. Current onboarding uses a
-- 13+ self-declaration plus required consent records instead.

