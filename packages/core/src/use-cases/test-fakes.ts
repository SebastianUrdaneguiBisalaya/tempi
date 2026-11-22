import { expect } from 'bun:test';
import type { AvatarImage } from '../domain/avatar';
import type { Calendar } from '../domain/calendar';
import { overlapsRange } from '../domain/date-range';
import type { CalendarEvent } from '../domain/event';
import type { GoogleCalendarLink, GoogleEventLink } from '../domain/google-sync';
import type { FetchedHolidayYear, TrackedHoliday } from '../domain/holiday';
import type { DomainErrorCode } from '../domain/result';
import type { Settings } from '../domain/settings';
import type { UserProfile } from '../domain/user-profile';
import type { AvatarStore } from '../ports/avatar-store';
import type { CalendarRepository } from '../ports/calendar-repository';
import type { Clock } from '../ports/clock';
import type { EventRepository } from '../ports/event-repository';
import type { GoogleSyncRepository } from '../ports/google-sync-repository';
import type { HolidayRepository } from '../ports/holiday-repository';
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

/** Lowercase without accents, like SQLite's `unicode61 remove_diacritics` tokenizer. */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export class InMemoryEventRepository implements EventRepository {
	readonly rows = new Map<string, CalendarEvent>();
	findById(id: string) {
		return Promise.resolve(this.rows.get(id) ?? null);
	}
	findByUid(calendarId: string, uid: string) {
		const found = [...this.rows.values()].find(event => event.calendarId === calendarId && event.deletedAt === null && event.recurringEventId === null && (event.icalUid ?? event.id) === uid);
		return Promise.resolve(found ?? null);
	}
	listByCalendar(calendarId: string) {
		return Promise.resolve([...this.rows.values()].filter(event => event.calendarId === calendarId && event.deletedAt === null).sort((a, b) => a.startAt.localeCompare(b.startAt)));
	}
	listInRange(range: { end: string; start: string }) {
		return Promise.resolve([...this.rows.values()].filter(event => event.deletedAt === null && event.rrule === null && overlapsRange(event.startAt, event.endAt, range)));
	}
	listBySeries(seriesId: string) {
		return Promise.resolve([...this.rows.values()].filter(event => event.deletedAt === null && event.recurringEventId === seriesId));
	}
	listSeries(before: string) {
		return Promise.resolve([...this.rows.values()].filter(event => event.deletedAt === null && event.rrule !== null && event.startAt < before));
	}
	search(text: string, limit: number) {
		const words = (value: string | null) => fold(value ?? '').split(/[^\p{L}\p{N}]+/u);
		const terms = words(text).filter(term => term !== '');
		const matches = (event: CalendarEvent) => {
			const eventWords = [event.title, event.location, event.description].flatMap(words);
			return terms.length > 0 && terms.every(term => eventWords.some(word => word.startsWith(term)));
		};
		const found = [...this.rows.values()].filter(event => event.deletedAt === null && matches(event)).sort((a, b) => b.startAt.localeCompare(a.startAt));
		return Promise.resolve(found.slice(0, limit));
	}
	save(event: CalendarEvent) {
		this.rows.set(event.id, event);
		return Promise.resolve();
	}
	moveToCalendar(fromCalendarId: string, toCalendarId: string, updatedAt: string) {
		for (const event of this.rows.values()) {
			if (event.calendarId === fromCalendarId && event.deletedAt === null) this.rows.set(event.id, { ...event, calendarId: toCalendarId, updatedAt });
		}
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

export class InMemoryGoogleSyncRepository implements GoogleSyncRepository {
	readonly calendarLinks = new Map<string, GoogleCalendarLink>();
	readonly eventLinks = new Map<string, GoogleEventLink>();
	private readonly events: InMemoryEventRepository;
	constructor(events: InMemoryEventRepository) {
		this.events = events;
	}
	listCalendars() {
		return Promise.resolve([...this.calendarLinks.values()]);
	}
	saveCalendar(link: GoogleCalendarLink) {
		this.calendarLinks.set(link.googleId, link);
		return Promise.resolve();
	}
	async deleteCalendar(googleId: string) {
		this.calendarLinks.delete(googleId);
		await this.deleteEventLinks(googleId);
	}
	deleteEventLinks(googleCalendarId: string) {
		for (const link of [...this.eventLinks.values()]) if (link.googleCalendarId === googleCalendarId) this.eventLinks.delete(link.eventId);
		return Promise.resolve();
	}
	findEventLink(eventId: string) {
		return Promise.resolve(this.eventLinks.get(eventId) ?? null);
	}
	findEventLinkByGoogleId(googleCalendarId: string, googleEventId: string) {
		return Promise.resolve([...this.eventLinks.values()].find(link => link.googleCalendarId === googleCalendarId && link.googleEventId === googleEventId) ?? null);
	}
	listEventLinks(googleCalendarId: string) {
		return Promise.resolve([...this.eventLinks.values()].filter(link => link.googleCalendarId === googleCalendarId));
	}
	saveEventLink(link: GoogleEventLink) {
		this.eventLinks.set(link.eventId, link);
		return Promise.resolve();
	}
	deleteEventLink(eventId: string) {
		this.eventLinks.delete(eventId);
		return Promise.resolve();
	}
	listPendingEvents(calendarIds: string[]) {
		const pending = [...this.events.rows.values()].filter(event => {
			const link = this.eventLinks.get(event.id);
			return link === undefined ? event.deletedAt === null && calendarIds.includes(event.calendarId) : event.updatedAt > link.syncedUpdatedAt;
		});
		return Promise.resolve(pending.sort((a, b) => Number(a.recurringEventId !== null) - Number(b.recurringEventId !== null)));
	}
	clear() {
		this.calendarLinks.clear();
		this.eventLinks.clear();
		return Promise.resolve();
	}
}

export class InMemoryHolidayRepository implements HolidayRepository {
	readonly holidays = new Map<string, TrackedHoliday>();
	readonly years = new Map<string, FetchedHolidayYear>();
	listHolidays() {
		return Promise.resolve([...this.holidays.values()]);
	}
	listFetchedYears() {
		return Promise.resolve([...this.years.values()]);
	}
	saveHoliday(holiday: TrackedHoliday) {
		this.holidays.set(`${holiday.country} ${holiday.date}`, holiday);
		return Promise.resolve();
	}
	saveFetchedYear(year: FetchedHolidayYear) {
		this.years.set(`${year.country} ${year.year}`, year);
		return Promise.resolve();
	}
	clear() {
		this.holidays.clear();
		this.years.clear();
		return Promise.resolve();
	}
}

export class InMemoryAvatarStore implements AvatarStore {
	readonly files = new Map<string, AvatarImage>();
	save(fileName: string, image: AvatarImage) {
		this.files.set(fileName, image);
		return Promise.resolve();
	}
	remove(fileName: string) {
		this.files.delete(fileName);
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
	const events = new InMemoryEventRepository();
	const deps = {
		avatars: new InMemoryAvatarStore(),
		calendars: new InMemoryCalendarRepository(),
		clock: new FakeClock(new Date(T0)),
		events,
		googleSync: new InMemoryGoogleSyncRepository(events),
		holidays: new InMemoryHolidayRepository(),
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
