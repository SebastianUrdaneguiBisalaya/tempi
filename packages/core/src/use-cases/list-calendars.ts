import type { Calendar } from '../domain/calendar';
import type { CoreDeps } from './deps';

/** Non-deleted calendars: the default first, then by name. */
export const listCalendars = async (deps: Pick<CoreDeps, 'calendars'>): Promise<Calendar[]> => {
	const calendars = await deps.calendars.list();
	return calendars.filter(calendar => calendar.deletedAt === null).sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
};
