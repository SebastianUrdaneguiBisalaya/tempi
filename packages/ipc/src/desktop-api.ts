import type { Calendar, CalendarEvent, DateRange, Result, Settings, UserProfile } from '@tempi/core';

/** The bridge the preload exposes as `window.desktop`. Every call resolves to a `Result`; none throws. */
export type DesktopApi = {
	calendars: {
		get(id: string): Promise<Result<Calendar | null>>;
		list(): Promise<Result<Calendar[]>>;
		save(calendar: Calendar): Promise<Result<null>>;
	};
	events: {
		deleteByCalendar(payload: { calendarId: string; deletedAt: string }): Promise<Result<null>>;
		get(id: string): Promise<Result<CalendarEvent | null>>;
		list(range: DateRange): Promise<Result<CalendarEvent[]>>;
		save(event: CalendarEvent): Promise<Result<null>>;
	};
	profile: {
		get(): Promise<Result<UserProfile | null>>;
		save(profile: UserProfile): Promise<Result<null>>;
	};
	settings: {
		get(): Promise<Result<Settings | null>>;
		save(settings: Settings): Promise<Result<null>>;
	};
	/** Electron version, for diagnostics. */
	version: string;
};

declare global {
	interface Window {
		/** Present only inside the desktop app; feature-detect it, never assume it. */
		desktop?: DesktopApi;
	}
}
