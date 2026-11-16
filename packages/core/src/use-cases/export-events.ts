import type { Calendar } from '../domain/calendar';
import type { CalendarEvent } from '../domain/event';
import { type ExportEventsInput, exportEventsInputSchema } from '../domain/ical-transfer';
import { fail, ok, parseWith, type Result } from '../domain/result';
import type { CoreDeps } from './deps';

/** What an export writes: the calendars and every live event they hold (series and edited occurrences included). */
export type ExportedCalendars = { calendars: Calendar[]; events: CalendarEvent[] };

export const exportEvents = async (deps: Pick<CoreDeps, 'calendars' | 'events'>, input: ExportEventsInput): Promise<Result<ExportedCalendars>> => {
	const parsed = parseWith(exportEventsInputSchema, input);
	if (!parsed.ok) return parsed;
	const { calendarId } = parsed.value;

	const all = await deps.calendars.list();
	const calendars = calendarId === null ? all : all.filter(calendar => calendar.id === calendarId);
	if (calendarId !== null && calendars.length === 0) return fail('not_found', 'calendar.notFound', { detail: `Calendar ${calendarId} not found`, field: 'calendarId' });

	const events = (await Promise.all(calendars.map(calendar => deps.events.listByCalendar(calendar.id)))).flat();
	return ok({ calendars, events });
};
