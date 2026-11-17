-- Whether reminders show as notifications and whether dictation and voice may use the microphone. Both start on.
ALTER TABLE settings ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 1 CHECK (notifications_enabled IN (0, 1));
ALTER TABLE settings ADD COLUMN microphone_enabled INTEGER NOT NULL DEFAULT 1 CHECK (microphone_enabled IN (0, 1));
