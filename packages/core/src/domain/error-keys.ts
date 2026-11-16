/**
 * Every error key core can emit, with an English description for developers (logs, `detail`).
 * User-facing translations live in `@tempi/i18n`, which must cover every key here.
 */
export const ERROR_KEYS = {
	'calendar.color': 'Color must be a #rrggbb hex value',
	'calendar.defaultNotDeletable': 'The default calendar cannot be deleted',
	'calendar.defaultRequired': 'A calendar must stay the default; promote another one instead',
	'calendar.notFound': 'Calendar not found',
	'event.endBeforeStart': 'Event end must be after its start',
	'event.notFound': 'Event not found',
	'event.rrule': 'Recurrence must be an RFC 5545 RRULE',
	'profile.country': 'Country must be an ISO 3166-1 alpha-2 code',
	'range.endBeforeStart': 'Range end must be after its start',
	'system.unexpected': 'Unexpected failure; see detail',
	'validation.custom': 'Invalid value',
	'validation.instant': 'Value must be an ISO-8601 instant with offset',
	'validation.integer': 'Value must be a whole number',
	'validation.invalid_element': 'Invalid element',
	'validation.invalid_format': 'Invalid format',
	'validation.invalid_key': 'Invalid key',
	'validation.invalid_type': 'Invalid type',
	'validation.invalid_union': 'Value matches none of the allowed shapes',
	'validation.invalid_value': 'Value is not one of the allowed options',
	'validation.max': 'Value is too large',
	'validation.min': 'Value is too small',
	'validation.not_multiple_of': 'Value is not a multiple of the required step',
	'validation.required': 'Value is required',
	'validation.timeZone': 'Time zone must be a valid IANA zone',
	'validation.too_big': 'Value is too large',
	'validation.too_small': 'Value is too small',
	'validation.unrecognized_keys': 'Unknown fields',
	'validation.url': 'Value must be an http(s) URL',
} as const;

export type ErrorKey = keyof typeof ERROR_KEYS;

export const isErrorKey = (value: string): value is ErrorKey => Object.hasOwn(ERROR_KEYS, value);
