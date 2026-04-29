-- Migration: Convert tabular_review_chat_messages.content from TEXT to JSONB
-- and add annotations JSONB column.
--
-- User messages:     content TEXT → JSON string  (e.g. "hello" → '"hello"')
-- Assistant messages: content TEXT → events array (e.g. "answer" → '[{"type":"content","text":"answer"}]')
--
-- Run this once against your Supabase database.

ALTER TABLE tabular_review_chat_messages
  ALTER COLUMN content TYPE jsonb
  USING CASE
    WHEN role = 'user'
      THEN to_jsonb(content)
    ELSE
      jsonb_build_array(jsonb_build_object('type', 'content', 'text', content))
  END;

ALTER TABLE tabular_review_chat_messages
  ADD COLUMN IF NOT EXISTS annotations jsonb;
