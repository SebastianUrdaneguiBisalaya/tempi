import { type Calendar, type CalendarPatch, calendarPatchSchema } from '../domain/calendar';
import { fail, ok, parseWith, type Result } from '../domain/result';
import { unsetOtherDefaults } from './default-calendar';
import { type CoreDeps, nowIso } from './deps';

export const updateCalendar = async (deps: Pick<CoreDeps, 'calendars' | 'clock'>, id: string, patch: CalendarPatch): Promise<Result<Calendar>> => {
	const current = await deps.calendars.findById(id);
	if (current === null || current.deletedAt !== null) return fail('not_found', 'calendar.notFound', 'id');

	const changes = parseWith(calendarPatchSchema, patch);
	if (!changes.ok) return changes;

	// Unsetting the only default would leave new events without a calendar; promote another one instead.
	if (current.isDefault && changes.value.isDefault === false) return fail('conflict', 'calendar.defaultRequired', 'isDefault');

	const now = nowIso(deps.clock);
	const calendar: Calendar = { ...current, ...changes.value, updatedAt: now };
	await deps.calendars.save(calendar);
	if (calendar.isDefault && !current.isDefault) await unsetOtherDefaults(deps, id, now);
	return ok(calendar);
};
