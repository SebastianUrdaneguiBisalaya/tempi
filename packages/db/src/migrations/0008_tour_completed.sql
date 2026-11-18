-- Whether the guided tour of the main screen was finished or dismissed. Existing installations start at 0, so they see it once.
ALTER TABLE settings ADD COLUMN tour_completed INTEGER NOT NULL DEFAULT 0 CHECK (tour_completed IN (0, 1));
