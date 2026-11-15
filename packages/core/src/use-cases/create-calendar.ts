import { type Calendar, type NewCalendarInput, newCalendarInputSchema } from '../domain/calendar';
import { ok, parseWith, type Result } from '../domain/result';
import { unsetOtherDefaults } from './default-calendar';
import { type CoreDeps, nowIso } from './deps';

/** The first calendar always becomes the default, so events always have somewhere to go. */
export const createCalendar = async (deps: Pick<CoreDeps, 'calendars' | 'clock' | 'ids'>, input: NewCalendarInput): Promise<Result<Calendar>> => {
	const fields = parseWith(newCalendarInputSchema, input);
	if (!fields.ok) return fields;

	const existing = await deps.calendars.list();
	const now = nowIso(deps.clock);
	const calendar: Calendar = {
		...fields.value,
		createdAt: now,
		deletedAt: null,
		id: deps.ids.next(),
		isDefault: existing.length === 0 || (fields.value.isDefault ?? false),
		updatedAt: now,
	};
	await deps.calendars.save(calendar);
	if (calendar.isDefault) await unsetOtherDefaults(deps, calendar.id, now);
	return ok(calendar);
};
