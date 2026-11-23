-- Whether an event asks for a Google Meet, which Google creates when the event is pushed to a Google calendar.
ALTER TABLE events ADD COLUMN google_meet INTEGER NOT NULL DEFAULT 0 CHECK (google_meet IN (0, 1));

-- Whether the Google event had a Google Meet when last synced, so a push only adds or removes one when it changed
-- and never touches an add-on conference (Zoom, Teams…).
ALTER TABLE google_events ADD COLUMN meet INTEGER NOT NULL DEFAULT 0 CHECK (meet IN (0, 1));
