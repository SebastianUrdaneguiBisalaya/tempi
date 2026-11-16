import type { DateRange, DomainError, Result } from '@tempi/core';

/**
 * Turns a use-case `Result` into a query/mutation outcome: the value, or the `DomainError` thrown as is.
 * The error stays plain data (typed through `Register.defaultError`), so the UI translates its issues with `issueTranslation`.
 */
export const unwrap = <T>(result: Result<T>): T => {
	if (!result.ok) throw result.error;
	return result.value;
};

/** For calls made outside the desktop app, where there is no storage to reach. */
export const STORAGE_UNAVAILABLE: DomainError = {
	code: 'internal',
	issues: [{ detail: 'Storage is unavailable outside the desktop app', key: 'system.unexpected' }],
};

/**
 * Every query key, grouped by domain. Mutations invalidate a domain's root key (e.g. `queryKeys.events.all`),
 * which refreshes every view of that domain at once.
 */
export const queryKeys = {
	calendars: { all: ['calendars'] },
	events: { all: ['events'], range: (range: DateRange) => ['events', range.start, range.end], search: (query: string) => ['events', 'search', query] },
	profile: { all: ['profile'] },
	settings: { all: ['settings'] },
} as const;
