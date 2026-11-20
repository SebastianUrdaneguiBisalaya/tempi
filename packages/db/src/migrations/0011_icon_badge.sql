-- Today's remaining events on the app icon. Existing installations get it on, like new ones.
ALTER TABLE settings ADD COLUMN icon_badge_enabled INTEGER NOT NULL DEFAULT 1 CHECK (icon_badge_enabled IN (0, 1));
