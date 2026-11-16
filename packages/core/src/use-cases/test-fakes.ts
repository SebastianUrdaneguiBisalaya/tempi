import { expect } from 'bun:test';
import type { AvatarImage } from '../domain/avatar';
import type { Calendar } from '../domain/calendar';
import { overlapsRange } from '../domain/date-range';
import type { CalendarEvent } from '../domain/event';
import type { DomainErrorCode } from '../domain/result';
import type { Settings } from '../domain/settings';
import type { UserProfile } from '../domain/user-profile';
import type { AvatarStore } from '../ports/avatar-store';
import type { CalendarRepository } from '../ports/calendar-repository';
import type { Clock } from '../ports/clock';
import type { EventRepository } from '../ports/event-repository';
import type { IdGenerator } from '../ports/id-generator';
import type { ProfileRepository } from '../ports/profile-repository';
import type { SettingsRepository } from '../ports/settings-repository';
import type { CoreDeps } from './deps';

export class FakeClock implements Clock {
	private current: Date;
	constructor(start: Date) {
		this.current = start;
	}
	now(): Date {
		return new Date(this.current);
	}
	set(iso: string): void {
		this.current = new Date(iso);
	}
}

export const sequentialIds = (): IdGenerator => {
	let n = 0;
	return { next: () => `id-${++n}` };
};

export class InMemoryEventRepository implements EventRepository {
	readonly rows = new Map<string, CalendarEvent>();
	findById(id: string) {
		return Promise.resolve(this.rows.get(id) ?? null);
	}
	listInRange(range: { end: string; start: string }) {
		return Promise.resolve([...this.rows.values()].filter(event => event.deletedAt === null && overlapsRange(event.startAt, event.endAt, range)));
	}
	save(event: CalendarEvent) {
		this.rows.set(event.id, event);
		return Promise.resolve();
	}
	softDeleteByCalendar(calendarId: string, deletedAt: string) {
		for (const event of this.rows.values()) {
			if (event.calendarId === calendarId && event.deletedAt === null) this.rows.set(event.id, { ...event, deletedAt, updatedAt: deletedAt });
		}
		return Promise.resolve();
	}
}

export class InMemoryCalendarRepository implements CalendarRepository {
	readonly rows = new Map<string, Calendar>();
	findById(id: string) {
		return Promise.resolve(this.rows.get(id) ?? null);
	}
	list() {
		return Promise.resolve([...this.rows.values()].filter(calendar => calendar.deletedAt === null));
	}
	save(calendar: Calendar) {
		this.rows.set(calendar.id, calendar);
		return Promise.resolve();
	}
}

export class InMemoryAvatarStore implements AvatarStore {
	readonly files = new Map<string, AvatarImage>();
	save(fileName: string, image: AvatarImage) {
		this.files.set(fileName, image);
		return Promise.resolve();
	}
}

export class InMemorySingleton<T> {
	value: T | null = null;
	get() {
		return Promise.resolve(this.value);
	}
	save(value: T) {
		this.value = value;
		return Promise.resolve();
	}
}

export const T0 = '2026-11-15T10:00:00.000Z';

export const makeDeps = () => {
	const deps = {
		avatars: new InMemoryAvatarStore(),
		calendars: new InMemoryCalendarRepository(),
		clock: new FakeClock(new Date(T0)),
		events: new InMemoryEventRepository(),
		ids: sequentialIds(),
		profile: new InMemorySingleton<UserProfile>() satisfies ProfileRepository,
		settings: new InMemorySingleton<Settings>() satisfies SettingsRepository,
	} satisfies CoreDeps;
	return deps;
};

/** Matcher for a failed Result with the given code, optionally reporting an issue on `field`. */
export const failure = (code: DomainErrorCode, field?: string) => ({
	error: { code, issues: field === undefined ? expect.any(Array) : expect.arrayContaining([expect.objectContaining({ field })]) },
	ok: false as const,
});
