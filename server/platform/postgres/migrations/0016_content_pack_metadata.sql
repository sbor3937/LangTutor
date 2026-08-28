ALTER TABLE learning.programs ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE learning.courses ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
