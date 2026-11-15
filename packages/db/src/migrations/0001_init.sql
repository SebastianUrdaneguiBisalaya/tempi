-- Instants are UTC ISO-8601 text (`…Z`), so lexical order is chronological order.
-- Booleans are 0/1 integers. Ids are UUIDv7 text.

CREATE TABLE calendars (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL,
	color TEXT NOT NULL,
	source TEXT NOT NULL,
	is_default INTEGER NOT NULL CHECK (is_default IN (0, 1)),
	is_visible INTEGER NOT NULL CHECK (is_visible IN (0, 1)),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	deleted_at TEXT
) STRICT;

CREATE TABLE events (
	id TEXT PRIMARY KEY NOT NULL,
	calendar_id TEXT NOT NULL REFERENCES calendars (id),
	title TEXT NOT NULL,
	description TEXT,
	location TEXT,
	video_url TEXT,
	start_at TEXT NOT NULL,
	end_at TEXT NOT NULL,
	all_day INTEGER NOT NULL CHECK (all_day IN (0, 1)),
	time_zone TEXT NOT NULL,
	rrule TEXT,
	reminder_minutes INTEGER,
	status TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	deleted_at TEXT
) STRICT;

CREATE INDEX events_start_at_end_at ON events (start_at, end_at);
CREATE INDEX events_calendar_id ON events (calendar_id);

-- One profile and one settings row per installation; the CHECK pins the single row.
CREATE TABLE profile (
	id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
	first_name TEXT NOT NULL,
	last_name TEXT NOT NULL,
	country TEXT NOT NULL,
	time_zone TEXT NOT NULL,
	avatar TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE settings (
	id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
	default_event_duration INTEGER NOT NULL,
	language TEXT NOT NULL,
	menu_bar_enabled INTEGER NOT NULL CHECK (menu_bar_enabled IN (0, 1)),
	onboarding_completed INTEGER NOT NULL CHECK (onboarding_completed IN (0, 1)),
	show_weekends INTEGER NOT NULL CHECK (show_weekends IN (0, 1)),
	show_week_numbers INTEGER NOT NULL CHECK (show_week_numbers IN (0, 1)),
	theme TEXT NOT NULL,
	time_format TEXT NOT NULL,
	week_start TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
) STRICT;
