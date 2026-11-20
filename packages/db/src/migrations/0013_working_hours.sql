-- Working hours: one range for the chosen weekdays (JSON array of 1–7, Monday = 1), as HH:MM text. Off by default.
ALTER TABLE settings ADD COLUMN working_hours_enabled INTEGER NOT NULL DEFAULT 0 CHECK (working_hours_enabled IN (0, 1));
ALTER TABLE settings ADD COLUMN working_hours_days TEXT NOT NULL DEFAULT '[1,2,3,4,5]' CHECK (json_valid(working_hours_days) AND json_type(working_hours_days) = 'array');
ALTER TABLE settings ADD COLUMN working_hours_start TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE settings ADD COLUMN working_hours_end TEXT NOT NULL DEFAULT '18:00';
