-- Keep the published introduction mission in lockstep with the verified
-- runtime curriculum. Existing projects may contain an earlier payload shape
-- that predates explicit prompt-language attribution.

with canonical_activities (id, payload) as (
  values
    ('act-name-meaning-v1', $json$
      {"id":"act-name-meaning-v1","type":"multiple_choice","prompt":"What does \"Je m'appelle Jamie\" mean?","promptFrenchSegments":["Je m'appelle Jamie"],"helperText":"Choose the everyday meaning.","contentItemIds":["phrase-je-mappelle-v1"],"grammarRuleIds":[],"estimatedSeconds":25,"choices":[{"id":"a","label":"My name is Jamie.","language":"en"},{"id":"b","label":"I am from Jamie.","language":"en"},{"id":"c","label":"I like Jamie.","language":"en"}],"acceptedAnswers":[{"value":"a"}],"feedbackCorrect":"Exactly. This is a neutral, safe everyday introduction.","feedbackIncorrect":"Use \"Je m'appelle...\" to say your name."}
    $json$::jsonb),
    ('act-age-fill-v1', $json$
      {"id":"act-age-fill-v1","type":"fill_blank","prompt":"Fill the gap: J'___ 20 ans.","promptFrenchSegments":["J'___ 20 ans."],"helperText":"French uses a verb meaning \"to have\" for age.","placeholder":"Type one word","contentItemIds":["rule-age-avoir-v1"],"grammarRuleIds":["rule-age-avoir-v1"],"estimatedSeconds":25,"acceptedAnswers":[{"value":"ai","allowAccentless":true}],"nearMisses":[{"value":"suis","mistakeType":"grammar","ruleId":"rule-age-avoir-v1","explanation":"French uses avoir for age, not être.","correctedAnswer":"J'ai 20 ans."}],"feedbackCorrect":"Yes—J'ai 20 ans is the standard pattern.","feedbackIncorrect":"For age, French uses avoir: J'ai 20 ans."}
    $json$::jsonb),
    ('act-age-typing-v1', $json$
      {"id":"act-age-typing-v1","type":"typing","prompt":"Write: I am 20 years old.","promptFrenchSegments":[],"helperText":"Use the complete French sentence.","placeholder":"Write your answer in French","contentItemIds":["rule-age-avoir-v1"],"grammarRuleIds":["rule-age-avoir-v1"],"estimatedSeconds":35,"acceptedAnswers":[{"value":"J'ai 20 ans"}],"nearMisses":[{"value":"Je suis 20 ans","mistakeType":"grammar","ruleId":"rule-age-avoir-v1","explanation":"French uses avoir for age, not être.","correctedAnswer":"J'ai 20 ans."}],"feedbackCorrect":"Great recall. French literally says \"I have 20 years.\"","feedbackIncorrect":"Use avoir for age: J'ai 20 ans."}
    $json$::jsonb),
    ('act-origin-builder-v1', $json$
      {"id":"act-origin-builder-v1","type":"sentence_builder","prompt":"Put the words in order: I come from Belfast.","promptFrenchSegments":[],"helperText":"Tap the words in their French order.","tokens":["Je","viens","de","Belfast"],"contentItemIds":["phrase-je-viens-de-v1"],"grammarRuleIds":["phrase-je-viens-de-v1"],"estimatedSeconds":35,"acceptedAnswers":[{"value":"Je viens de Belfast"}],"feedbackCorrect":"Well built. Use venir de for where you come from.","feedbackIncorrect":"The safe pattern is: Je viens de Belfast."}
    $json$::jsonb),
    ('act-dictation-v1', $json$
      {"id":"act-dictation-v1","type":"dictation","prompt":"Dictation practice: type the phrase you hear.","promptFrenchSegments":[],"helperText":"Play the audio, then type what you hear.","targetText":"Je m'appelle Jamie.","placeholder":"Type the phrase","contentItemIds":["phrase-je-mappelle-v1"],"grammarRuleIds":[],"estimatedSeconds":40,"acceptedAnswers":[{"value":"Je m'appelle Jamie"}],"feedbackCorrect":"Nice. You matched the sounds to the words.","feedbackIncorrect":"The target phrase is: Je m'appelle Jamie."}
    $json$::jsonb),
    ('act-speak-repeat-v1', $json$
      {"id":"act-speak-repeat-v1","type":"speak_repeat","prompt":"Say this out loud: Aujourd'hui, j'étudie le français.","promptFrenchSegments":["Aujourd'hui, j'étudie le français."],"helperText":"This is a speaking self-check. No recording, transcription, or pronunciation score is used.","targetText":"Aujourd'hui, j'étudie le français.","contentItemIds":["phrase-aujourdhui-v1"],"grammarRuleIds":[],"estimatedSeconds":30,"acceptedAnswers":[{"value":"completed"}],"feedbackCorrect":"Good work. Notice the rhythm: aujourd'hui | j'étudie | le français.","feedbackIncorrect":"Try the phrase once more at a comfortable pace."}
    $json$::jsonb),
    ('act-register-v1', $json$
      {"id":"act-register-v1","type":"multiple_choice","prompt":"Which version is more casual in a relaxed spoken introduction?","promptFrenchSegments":[],"helperText":"Both can be useful—choose the relaxed spoken option.","contentItemIds":["phrase-je-mappelle-v1","phrase-moi-cest-v1"],"grammarRuleIds":[],"estimatedSeconds":25,"choices":[{"id":"a","label":"Je m'appelle Jamie.","language":"fr"},{"id":"b","label":"Moi, c'est Jamie.","language":"fr"}],"acceptedAnswers":[{"value":"b","register":"casual"}],"feedbackCorrect":"Right. \"Moi, c'est...\" is a relaxed spoken option; \"Je m'appelle...\" is the safer neutral default.","feedbackIncorrect":"\"Je m'appelle...\" is neutral. \"Moi, c'est...\" is more casual and spoken."}
    $json$::jsonb)
)
update public.activities as activity
set payload = canonical.payload
from canonical_activities as canonical
where activity.id = canonical.id
  and activity.mission_id = 'mission-introduce-yourself-v1'
  and activity.payload is distinct from canonical.payload;
