-- UI sounds on button presses. Existing installations get them on, with the `tick` preset, like new ones.
ALTER TABLE settings ADD COLUMN sounds_enabled INTEGER NOT NULL DEFAULT 1 CHECK (sounds_enabled IN (0, 1));
ALTER TABLE settings ADD COLUMN sound TEXT NOT NULL DEFAULT 'tick';
