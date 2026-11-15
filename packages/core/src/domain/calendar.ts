import { fail, ok, type Result } from './result';
import type { Timestamps } from './timestamps';

export const CALENDAR_SOURCES = ['local', 'google'] as const;

export type CalendarSource = (typeof CALENDAR_SOURCES)[number];

export type Calendar = Timestamps & {
	/** Hex color `#rrggbb`, lowercase. */
	color: string;
	id: string;
	isDefault: boolean;
	isVisible: boolean;
	name: string;
	source: CalendarSource;
};

export type CalendarFields = Omit<Calendar, keyof Timestamps | 'id'>;

export type NewCalendarInput = {
	color: string;
	isDefault?: boolean;
	isVisible?: boolean;
	name: string;
	source?: CalendarSource;
};

export type CalendarPatch = Partial<Pick<CalendarFields, 'color' | 'isDefault' | 'isVisible' | 'name'>>;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const validateCalendarFields = (fields: CalendarFields): Result<CalendarFields> => {
	const name = fields.name.trim();
	if (name === '') return fail('validation', 'Name is required', 'name');
	if (!HEX_COLOR.test(fields.color)) return fail('validation', 'Color must be a #rrggbb hex value', 'color');
	if (!CALENDAR_SOURCES.includes(fields.source)) return fail('validation', 'Source must be local or google', 'source');
	return ok({ ...fields, color: fields.color.toLowerCase(), name });
};
