/// <reference path="../sql.d.ts" />
// Each SQL file is embedded at build time (Bun text import), so a bundled main process needs no files on disk.
// Add a migration: create `NNNN_name.sql` here and list it below.
import init from './0001_init.sql' with { type: 'text' };
import allDayCollapsed from './0002_all_day_collapsed.sql' with { type: 'text' };
import recurringEvents from './0003_recurring_events.sql' with { type: 'text' };
import eventSearch from './0004_event_search.sql' with { type: 'text' };
import icalUid from './0005_ical_uid.sql' with { type: 'text' };

export const MIGRATION_FILES: Record<string, string> = {
	'0001_init.sql': init,
	'0002_all_day_collapsed.sql': allDayCollapsed,
	'0003_recurring_events.sql': recurringEvents,
	'0004_event_search.sql': eventSearch,
	'0005_ical_uid.sql': icalUid,
};
