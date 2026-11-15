import type { DatabaseSync } from 'node:sqlite';
import type { Clock, IdGenerator } from '@tempi/core';

export const DEFAULT_CALENDAR = { color: '#3b82f6', name: 'Personal' } as const;

/**
 * Creates the default calendar when there is no live calendar, so events always have somewhere to go.
 * A single INSERT … WHERE NOT EXISTS keeps the check and the write atomic.
 */
export const seedDefaultCalendar = (db: DatabaseSync, deps: { clock: Clock; ids: IdGenerator }): void => {
	const now = deps.clock.now().toISOString();
	db.prepare(
		`INSERT INTO calendars (id, name, color, source, is_default, is_visible, created_at, updated_at, deleted_at)
		SELECT :id, :name, :color, 'local', 1, 1, :now, :now, NULL
		WHERE NOT EXISTS (SELECT 1 FROM calendars WHERE deleted_at IS NULL)`
	).run({ color: DEFAULT_CALENDAR.color, id: deps.ids.next(), name: DEFAULT_CALENDAR.name, now });
};
