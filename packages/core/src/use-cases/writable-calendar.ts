import type { Calendar } from '../domain/calendar';
import { fail, ok, type Result } from '../domain/result';
import type { CoreDeps } from './deps';

/** The live calendar `calendarId`, if its events may change: synced read-only calendars only change through sync. */
export const writableCalendar = async (deps: Pick<CoreDeps, 'calendars'>, calendarId: string, field = 'calendarId'): Promise<Result<Calendar>> => {
	const calendar = await deps.calendars.findById(calendarId);
	if (calendar === null || calendar.deletedAt !== null) return fail('not_found', 'calendar.notFound', { detail: `Calendar ${calendarId} not found`, field });
	if (calendar.readOnly) return fail('conflict', 'calendar.readOnly', { detail: `Calendar ${calendarId} is read-only`, field });
	return ok(calendar);
};

/** A Google Meet is created by Google, so only events in a Google calendar may ask for one. */
export const allowsGoogleMeet = (calendar: Calendar, googleMeet: boolean): Result<null> =>
	googleMeet && calendar.source !== 'google'
		? fail('validation', 'event.googleMeetCalendar', { detail: `Calendar ${calendar.id} is not a Google calendar, so its events can't have a Google Meet`, field: 'googleMeet' })
		: ok(null);
