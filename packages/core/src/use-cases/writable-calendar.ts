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

/** Google creates the Meet and invites the guests, so only events in a Google calendar may have either. */
export const allowsGoogleFields = (calendar: Calendar, event: { googleMeet: boolean; guests: readonly string[] }): Result<null> => {
	if (calendar.source === 'google') return ok(null);
	if (event.googleMeet)
		return fail('validation', 'event.googleMeetCalendar', { detail: `Calendar ${calendar.id} is not a Google calendar, so its events can't have a Google Meet`, field: 'googleMeet' });
	if (event.guests.length > 0) return fail('validation', 'event.guestsCalendar', { detail: `Calendar ${calendar.id} is not a Google calendar, so its events can't have guests`, field: 'guests' });
	return ok(null);
};

const sameGuests = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every(email => b.includes(email));

/** The guests of an event someone else organizes on Google (and doesn't let guests change) only change there. */
export const allowsGuestChange = (current: { guests: readonly string[]; guestsReadOnly: boolean; id: string }, guests: readonly string[] | undefined): Result<null> =>
	current.guestsReadOnly && guests !== undefined && !sameGuests(current.guests, guests)
		? fail('conflict', 'event.guestsReadOnly', { detail: `Event ${current.id} belongs to someone else on Google, so its guests can't change here`, field: 'guests' })
		: ok(null);
