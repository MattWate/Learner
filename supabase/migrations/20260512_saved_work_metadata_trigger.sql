-- Automatically tag saved_work rows for tutor dashboard reporting.
-- This avoids needing every frontend save path to manually provide subject/topic/language.
-- It only fills missing values and will not overwrite values explicitly supplied by the app.

CREATE OR REPLACE FUNCTION public.derive_saved_work_metadata()
RETURNS trigger AS $$
DECLARE
  prompt_text text;
  derived_subject text;
  derived_topic text;
  derived_language text;
BEGIN
  prompt_text := COALESCE(
    NULLIF(NEW.input_prompt->>'topic', ''),
    NULLIF(NEW.input_prompt->>'title', ''),
    NULLIF(NEW.input_prompt->>'question', ''),
    NULLIF(NEW.input_prompt->>'prompt', ''),
    NULLIF(NEW.input_prompt->>'input', ''),
    NULLIF(NEW.input_prompt->>'text', ''),
    NULLIF(NEW.input_prompt::text, ''),
    NULLIF(NEW.work_type, ''),
    'General learning activity'
  );

  derived_subject := CASE
    WHEN NEW.subject IS NOT NULL AND btrim(NEW.subject) <> '' THEN NEW.subject
    WHEN lower(COALESCE(NEW.work_type, '')) LIKE '%math%' THEN 'Mathematics'
    WHEN lower(COALESCE(NEW.work_type, '')) LIKE '%test%' THEN 'Practice test'
    WHEN lower(COALESCE(NEW.work_type, '')) LIKE '%learn%' THEN 'Learning hub'
    WHEN lower(COALESCE(NEW.work_type, '')) LIKE '%explain%' THEN 'Concept explanation'
    WHEN lower(COALESCE(NEW.work_type, '')) LIKE '%homework%' THEN 'Homework'
    ELSE initcap(replace(COALESCE(NULLIF(NEW.work_type, ''), 'learning_activity'), '_', ' '))
  END;

  derived_topic := CASE
    WHEN NEW.topic IS NOT NULL AND btrim(NEW.topic) <> '' THEN NEW.topic
    WHEN prompt_text IS NULL OR btrim(prompt_text) = '' THEN 'General learning activity'
    ELSE left(
      regexp_replace(
        regexp_replace(prompt_text, '\\s+', ' ', 'g'),
        '[\r\n\t]+', ' ', 'g'
      ),
      220
    )
  END;

  derived_language := CASE
    WHEN NEW.language IS NOT NULL AND btrim(NEW.language) <> '' THEN NEW.language
    WHEN NULLIF(NEW.input_prompt->>'language', '') IS NOT NULL THEN NEW.input_prompt->>'language'
    WHEN NULLIF(NEW.input_prompt->>'outputLanguage', '') IS NOT NULL THEN NEW.input_prompt->>'outputLanguage'
    ELSE 'English'
  END;

  NEW.subject := derived_subject;
  NEW.topic := derived_topic;
  NEW.language := derived_language;
  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
    'auto_tagged', true,
    'auto_tagged_at', now(),
    'auto_tag_method', 'db_trigger_v1',
    'source_work_type', NEW.work_type
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_saved_work_metadata ON public.saved_work;

CREATE TRIGGER set_saved_work_metadata
BEFORE INSERT OR UPDATE OF work_type, input_prompt, subject, topic, language, metadata
ON public.saved_work
FOR EACH ROW
EXECUTE FUNCTION public.derive_saved_work_metadata();

-- Optional: backfill recent rows that still have missing metadata.
-- Review first, then uncomment/run if desired.
-- UPDATE public.saved_work
-- SET metadata = COALESCE(metadata, '{}'::jsonb)
-- WHERE subject IS NULL OR topic IS NULL OR language IS NULL;

-- Verify trigger exists:
-- SELECT trigger_name, event_manipulation, action_timing
-- FROM information_schema.triggers
-- WHERE event_object_schema = 'public'
--   AND event_object_table = 'saved_work'
--   AND trigger_name = 'set_saved_work_metadata';
