import type { CalendarRepository } from '../ports/calendar-repository';
import type { Clock } from '../ports/clock';
import type { EventRepository } from '../ports/event-repository';
import type { IdGenerator } from '../ports/id-generator';
import type { ProfileRepository } from '../ports/profile-repository';
import type { SettingsRepository } from '../ports/settings-repository';

/** Every port a use case may need. Each use case asks only for its slice via `Pick`. */
export type CoreDeps = {
	calendars: CalendarRepository;
	clock: Clock;
	events: EventRepository;
	ids: IdGenerator;
	profile: ProfileRepository;
	settings: SettingsRepository;
};

export const nowIso = (clock: Clock): string => clock.now().toISOString();
