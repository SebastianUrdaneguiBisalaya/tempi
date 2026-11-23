-- The guests Google invites to an event, as a JSON array of lower-case emails, and whether they can only change on
-- Google (the event is someone else's and doesn't let guests change it).
ALTER TABLE events ADD COLUMN guests TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(guests) AND json_type(guests) = 'array');
ALTER TABLE events ADD COLUMN guests_read_only INTEGER NOT NULL DEFAULT 0 CHECK (guests_read_only IN (0, 1));

-- The attendees of the Google event as last synced (guests and the ones Tempi keeps but doesn't show), as JSON, so a
-- push only sends the list when the guests changed.
ALTER TABLE google_events ADD COLUMN attendees TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(attendees) AND json_type(attendees) = 'array');
