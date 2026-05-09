-- Backfill basic reporting metadata for existing saved_work rows.
-- This is intentionally conservative: it only fills missing subject/topic/language
-- using existing JSON fields and work_type heuristics. Review results before running UPDATE.

-- 1) Preview existing rows missing reporting tags
SELECT
  id,
  profile_id,
  work_type,
  subject,
  topic,
  language,
  input_prompt,
  created_at
FROM public.saved_work
WHERE subject IS NULL
   OR topic IS NULL
   OR language IS NULL
ORDER BY created_at DESC
LIMIT 50;

-- 2) Preview proposed derived metadata without changing anything
WITH proposed AS (
  SELECT
    id,
    work_type,
    subject AS existing_subject,
    topic AS existing_topic,
    language AS existing_language,
    COALESCE(
      subject,
      NULLIF(input_prompt->>'subject', ''),
      NULLIF(input_prompt->>'learningArea', ''),
      NULLIF(input_prompt->>'schoolSubject', ''),
      CASE
        WHEN lower(work_type) LIKE '%math%' THEN 'Mathematics'
        WHEN lower(work_type) LIKE '%homework%' THEN 'Homework'
        WHEN lower(work_type) LIKE '%explain%' THEN 'Concept explanation'
        WHEN lower(work_type) LIKE '%test%' THEN 'Practice test'
        WHEN lower(work_type) LIKE '%learn%' THEN 'Learning hub'
        ELSE initcap(replace(work_type, '_', ' '))
      END
    ) AS proposed_subject,
    COALESCE(
      topic,
      NULLIF(input_prompt->>'topic', ''),
      NULLIF(input_prompt->>'title', ''),
      NULLIF(input_prompt->>'question', ''),
      NULLIF(input_prompt->>'prompt', ''),
      CASE
        WHEN lower(work_type) LIKE '%math%' THEN 'Mathematics support'
        WHEN lower(work_type) LIKE '%homework%' THEN 'Homework support'
        WHEN lower(work_type) LIKE '%explain%' THEN 'Concept explanation'
        WHEN lower(work_type) LIKE '%test%' THEN 'Practice test'
        WHEN lower(work_type) LIKE '%learn%' THEN 'Revision and learning'
        ELSE 'General learning activity'
      END
    ) AS proposed_topic,
    COALESCE(
      language,
      NULLIF(input_prompt->>'language', ''),
      NULLIF(input_prompt->>'outputLanguage', ''),
      'English'
    ) AS proposed_language
  FROM public.saved_work
)
SELECT *
FROM proposed
ORDER BY id DESC
LIMIT 100;

-- 3) Run this UPDATE only after reviewing the preview above.
-- It fills blank metadata fields only; it will not overwrite existing subject/topic/language.
/*
UPDATE public.saved_work
SET
  subject = COALESCE(
    subject,
    NULLIF(input_prompt->>'subject', ''),
    NULLIF(input_prompt->>'learningArea', ''),
    NULLIF(input_prompt->>'schoolSubject', ''),
    CASE
      WHEN lower(work_type) LIKE '%math%' THEN 'Mathematics'
      WHEN lower(work_type) LIKE '%homework%' THEN 'Homework'
      WHEN lower(work_type) LIKE '%explain%' THEN 'Concept explanation'
      WHEN lower(work_type) LIKE '%test%' THEN 'Practice test'
      WHEN lower(work_type) LIKE '%learn%' THEN 'Learning hub'
      ELSE initcap(replace(work_type, '_', ' '))
    END
  ),
  topic = COALESCE(
    topic,
    NULLIF(input_prompt->>'topic', ''),
    NULLIF(input_prompt->>'title', ''),
    NULLIF(input_prompt->>'question', ''),
    NULLIF(input_prompt->>'prompt', ''),
    CASE
      WHEN lower(work_type) LIKE '%math%' THEN 'Mathematics support'
      WHEN lower(work_type) LIKE '%homework%' THEN 'Homework support'
      WHEN lower(work_type) LIKE '%explain%' THEN 'Concept explanation'
      WHEN lower(work_type) LIKE '%test%' THEN 'Practice test'
      WHEN lower(work_type) LIKE '%learn%' THEN 'Revision and learning'
      ELSE 'General learning activity'
    END
  ),
  language = COALESCE(
    language,
    NULLIF(input_prompt->>'language', ''),
    NULLIF(input_prompt->>'outputLanguage', ''),
    'English'
  ),
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'metadata_backfilled_at', now(),
    'metadata_backfill_method', 'basic_sql_heuristic'
  )
WHERE subject IS NULL
   OR topic IS NULL
   OR language IS NULL;
*/

-- 4) Verify after running the UPDATE
-- SELECT subject, topic, language, count(*)
-- FROM public.saved_work
-- GROUP BY subject, topic, language
-- ORDER BY count(*) DESC, subject, topic;
