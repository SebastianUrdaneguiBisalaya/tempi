-- Opening Tempi at login. Off for existing installations, like new ones: it changes how the computer starts.
ALTER TABLE settings ADD COLUMN open_at_login_enabled INTEGER NOT NULL DEFAULT 0 CHECK (open_at_login_enabled IN (0, 1));
