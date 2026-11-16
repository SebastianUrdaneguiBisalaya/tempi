-- Recurring events. A series keeps the original starts of the occurrences it skips (deleted or edited on their own)
-- as a JSON array of UTC instants. An edited occurrence is its own row pointing at its series and the start it replaces.
ALTER TABLE events ADD COLUMN ex_dates TEXT NOT NULL DEFAULT '[]';
ALTER TABLE events ADD COLUMN recurring_event_id TEXT REFERENCES events (id);
ALTER TABLE events ADD COLUMN original_start_at TEXT;

CREATE INDEX events_recurring_event_id ON events (recurring_event_id) WHERE recurring_event_id IS NOT NULL;
CREATE INDEX events_series_start_at ON events (start_at) WHERE rrule IS NOT NULL;
