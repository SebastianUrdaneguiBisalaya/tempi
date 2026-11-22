-- Public holidays from Nager.Date as all-day events: on by default.
ALTER TABLE settings ADD COLUMN holidays_enabled INTEGER NOT NULL DEFAULT 1 CHECK (holidays_enabled IN (0, 1));

-- Integration bookkeeping, never synced itself, so keyed by country and date. A row outlives its event's soft delete,
-- which is how a holiday the user deleted is never created again.
CREATE TABLE holidays (
	country TEXT NOT NULL CHECK (length(country) = 2 AND country = upper(country)),
	date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	event_id TEXT NOT NULL REFERENCES events (id),
	created_at TEXT NOT NULL,
	PRIMARY KEY (country, date)
) STRICT;

-- The years already fetched per country, so later launches only ask for a missing year.
CREATE TABLE holiday_years (
	country TEXT NOT NULL CHECK (length(country) = 2 AND country = upper(country)),
	year INTEGER NOT NULL CHECK (year BETWEEN 1 AND 9999),
	fetched_at TEXT NOT NULL,
	PRIMARY KEY (country, year)
) STRICT;
