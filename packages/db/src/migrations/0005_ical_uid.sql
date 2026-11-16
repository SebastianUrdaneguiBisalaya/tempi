-- iCalendar import: an imported event keeps its file's UID, so importing the file again into the same calendar
-- updates the event instead of adding a copy. Events made in Tempi leave it null and use their id as UID.
ALTER TABLE events ADD COLUMN ical_uid TEXT;

CREATE INDEX events_calendar_id_ical_uid ON events (calendar_id, ical_uid) WHERE ical_uid IS NOT NULL;
