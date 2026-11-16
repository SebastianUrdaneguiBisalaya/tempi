-- Google Calendar sync. A synced calendar the account may only read can't be changed in Tempi.
ALTER TABLE calendars ADD COLUMN read_only INTEGER NOT NULL DEFAULT 0 CHECK (read_only IN (0, 1));

-- The connected account's calendars as the last sync listed them; selected ones sync into `calendar_id`.
-- Sync bookkeeping, never synced itself, so keyed by Google's own ids.
CREATE TABLE google_calendars (
	google_id TEXT PRIMARY KEY NOT NULL,
	calendar_id TEXT REFERENCES calendars (id),
	name TEXT NOT NULL,
	color TEXT NOT NULL,
	access_role TEXT NOT NULL,
	is_primary INTEGER NOT NULL CHECK (is_primary IN (0, 1)),
	time_zone TEXT NOT NULL,
	selected INTEGER NOT NULL CHECK (selected IN (0, 1)),
	sync_token TEXT
) STRICT;

CREATE UNIQUE INDEX google_calendars_calendar_id ON google_calendars (calendar_id) WHERE calendar_id IS NOT NULL;

-- Local events and the Google events they sync with. `synced_updated_at` is the local `updated_at` Google last
-- matched: a later one is a change to push.
CREATE TABLE google_events (
	event_id TEXT PRIMARY KEY NOT NULL REFERENCES events (id),
	google_calendar_id TEXT NOT NULL,
	google_event_id TEXT NOT NULL,
	etag TEXT NOT NULL,
	synced_updated_at TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX google_events_google_id ON google_events (google_calendar_id, google_event_id);
