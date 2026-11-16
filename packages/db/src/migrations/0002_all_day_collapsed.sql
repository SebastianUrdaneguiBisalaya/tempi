-- Whether the all-day lane above the week/day grid is collapsed. Existing installations start expanded.
ALTER TABLE settings ADD COLUMN all_day_collapsed INTEGER NOT NULL DEFAULT 0 CHECK (all_day_collapsed IN (0, 1));
