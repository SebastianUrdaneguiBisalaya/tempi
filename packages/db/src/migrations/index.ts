/// <reference path="../sql.d.ts" />
// Each SQL file is embedded at build time (Bun text import), so a bundled main process needs no files on disk.
// Add a migration: create `NNNN_name.sql` here and list it below.
import init from './0001_init.sql' with { type: 'text' };
import allDayCollapsed from './0002_all_day_collapsed.sql' with { type: 'text' };
import recurringEvents from './0003_recurring_events.sql' with { type: 'text' };
import eventSearch from './0004_event_search.sql' with { type: 'text' };
import icalUid from './0005_ical_uid.sql' with { type: 'text' };
import googleSync from './0006_google_sync.sql' with { type: 'text' };
import permissionPreferences from './0007_permission_preferences.sql' with { type: 'text' };
import tourCompleted from './0008_tour_completed.sql' with { type: 'text' };
import uiSounds from './0009_ui_sounds.sql' with { type: 'text' };
import openAtLogin from './0010_open_at_login.sql' with { type: 'text' };
import iconBadge from './0011_icon_badge.sql' with { type: 'text' };
import secondaryTimeZones from './0012_secondary_time_zones.sql' with { type: 'text' };

export const MIGRATION_FILES: Record<string, string> = {
	'0001_init.sql': init,
	'0002_all_day_collapsed.sql': allDayCollapsed,
	'0003_recurring_events.sql': recurringEvents,
	'0004_event_search.sql': eventSearch,
	'0005_ical_uid.sql': icalUid,
	'0006_google_sync.sql': googleSync,
	'0007_permission_preferences.sql': permissionPreferences,
	'0008_tour_completed.sql': tourCompleted,
	'0009_ui_sounds.sql': uiSounds,
	'0010_open_at_login.sql': openAtLogin,
	'0011_icon_badge.sql': iconBadge,
	'0012_secondary_time_zones.sql': secondaryTimeZones,
};
