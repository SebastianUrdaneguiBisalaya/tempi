import { type Calendar, type CalendarPatch, validateCalendarFields } from '../domain/calendar';
import { fail, ok, type Result } from '../domain/result';
import { unsetOtherDefaults } from './default-calendar';
import { type CoreDeps, nowIso } from './deps';

export const updateCalendar = async (deps: Pick<CoreDeps, 'calendars' | 'clock'>, id: string, patch: CalendarPatch): Promise<Result<Calendar>> => {
	const current = await deps.calendars.findById(id);
	if (current === null || current.deletedAt !== null) return fail('not_found', 'Calendar not found', 'id');

	// Unsetting the only default would leave new events without a calendar; promote another one instead.
	if (current.isDefault && patch.isDefault === false) return fail('conflict', 'Make another calendar the default instead', 'isDefault');

	const { createdAt, deletedAt, id: _id, updatedAt: _updatedAt, ...currentFields } = current;
	const fields = validateCalendarFields({ ...currentFields, ...patch });
	if (!fields.ok) return fields;

	const now = nowIso(deps.clock);
	const calendar: Calendar = { ...fields.value, createdAt, deletedAt, id, updatedAt: now };
	await deps.calendars.save(calendar);
	if (calendar.isDefault && !current.isDefault) await unsetOtherDefaults(deps, id, now);
	return ok(calendar);
};
