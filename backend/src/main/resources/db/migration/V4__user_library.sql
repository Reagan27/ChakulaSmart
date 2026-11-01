-- V4: foods and recipes can be created by admins, nutritionists and businesses.
-- owner_id NULL = built-in library item. active = FALSE hides an item that is still referenced by plans/diaries.
ALTER TABLE foods   ADD COLUMN owner_id   BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE foods   ADD COLUMN active     BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE foods   ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE recipes ADD COLUMN owner_id   BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE recipes ADD COLUMN active     BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE recipes ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX idx_foods_owner   ON foods (owner_id);
CREATE INDEX idx_recipes_owner ON recipes (owner_id);
