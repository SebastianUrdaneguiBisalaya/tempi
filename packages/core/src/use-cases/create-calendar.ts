import { type Calendar, type NewCalendarInput, validateCalendarFields } from '../domain/calendar';
import { ok, type Result } from '../domain/result';
import { unsetOtherDefaults } from './default-calendar';
import { type CoreDeps, nowIso } from './deps';

/** The first calendar always becomes the default, so events always have somewhere to go. */
export const createCalendar = async (deps: Pick<CoreDeps, 'calendars' | 'clock' | 'ids'>, input: NewCalendarInput): Promise<Result<Calendar>> => {
	const existing = await deps.calendars.list();
	const fields = validateCalendarFields({
		color: input.color,
		isDefault: existing.length === 0 || (input.isDefault ?? false),
		isVisible: input.isVisible ?? true,
		name: input.name,
		source: input.source ?? 'local',
	});
	if (!fields.ok) return fields;

	const now = nowIso(deps.clock);
	const calendar: Calendar = { ...fields.value, createdAt: now, deletedAt: null, id: deps.ids.next(), updatedAt: now };
	await deps.calendars.save(calendar);
	if (calendar.isDefault) await unsetOtherDefaults(deps, calendar.id, now);
	return ok(calendar);
};
