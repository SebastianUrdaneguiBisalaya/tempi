import {
	type CalendarEvent,
	type CoreDeps,
	detachGoogleCalendar,
	eventFieldsSchema,
	GOOGLE_ACCESS_ROLES,
	type GoogleAccessRole,
	type GoogleCalendarLink,
	type GoogleEventLink,
	isValidTimeZone,
	isWritableRole,
	toUtcInstant,
} from '@tempi/core';
import { isMeshlyError } from '@usemeshly/auth';
import type { GoogleCalendarClient, GoogleCalendarListEntry, GoogleEvent } from '@usemeshly/google-calendar';
import { fromGoogle, googleEventIdFor, hasMeet, instanceId, instantOf, meetLinkOf, type PulledFields, toGoogle } from './mapping';

export type SyncDeps = Pick<CoreDeps, 'calendars' | 'clock' | 'events' | 'googleSync' | 'ids'>;

export type GoogleSyncOptions = {
	api: GoogleCalendarClient;
	/** Runs `work` as one local transaction. Network calls happen between transactions, never inside one. */
	transact: <T>(work: (deps: SyncDeps) => Promise<T>) => Promise<T>;
};

/** What one sync did: changes applied from Google, changes sent to it, and Google events Tempi couldn't take. */
export type SyncSummary = { pulled: number; pushed: number; skipped: number };

const FALLBACK_COLOR = '#039be5';
const isAccessRole = (role: string): role is GoogleAccessRole => GOOGLE_ACCESS_ROLES.some(known => known === role);

/** A local change not yet on Google. */
const isPending = (event: CalendarEvent, link: GoogleEventLink): boolean => event.updatedAt > link.syncedUpdatedAt;

/** When Google last changed an event, as UTC; falls back to now for the rare item without `updated`. */
const remoteUpdated = (event: GoogleEvent, now: string): string => (event.updated === undefined ? null : toUtcInstant(event.updated)) ?? now;

/**
 * Brings the local list of Google calendars up to date: new ones are offered (the primary one selected on the first
 * listing), selected ones get a local calendar with Google's name and color, and ones gone from the account leave
 * Tempi. Returns the selected calendars with their local ids.
 */
const reconcileCalendars = async (deps: SyncDeps, entries: GoogleCalendarListEntry[]): Promise<GoogleCalendarLink[]> => {
	const existing = new Map((await deps.googleSync.listCalendars()).map(link => [link.googleId, link]));
	const firstListing = existing.size === 0;
	const now = deps.clock.now().toISOString();
	const active: GoogleCalendarLink[] = [];
	const listed = new Set<string>();

	for (const entry of entries) {
		if (entry.deleted === true || !isAccessRole(entry.accessRole)) continue;
		listed.add(entry.id);
		const previous = existing.get(entry.id);
		const color = /^#[0-9a-f]{6}$/i.test(entry.backgroundColor ?? '') ? (entry.backgroundColor ?? FALLBACK_COLOR).toLowerCase() : FALLBACK_COLOR;
		const link: GoogleCalendarLink = {
			accessRole: entry.accessRole,
			calendarId: previous?.calendarId ?? null,
			color,
			googleId: entry.id,
			name: entry.summaryOverride ?? entry.summary ?? entry.id,
			primary: entry.primary === true,
			selected: previous?.selected ?? (firstListing && entry.primary === true),
			syncToken: previous?.syncToken ?? null,
			timeZone: entry.timeZone !== undefined && isValidTimeZone(entry.timeZone) ? entry.timeZone : (previous?.timeZone ?? 'UTC'),
		};
		const readOnly = !isWritableRole(link.accessRole);
		if (link.selected) {
			const calendar = link.calendarId === null ? null : await deps.calendars.findById(link.calendarId);
			if (calendar === null || calendar.deletedAt !== null) {
				link.calendarId = deps.ids.next();
				link.syncToken = null;
				await deps.calendars.save({
					color: link.color,
					createdAt: now,
					deletedAt: null,
					id: link.calendarId,
					isDefault: false,
					isVisible: true,
					name: link.name,
					readOnly,
					source: 'google',
					updatedAt: now,
				});
			} else if (calendar.readOnly !== readOnly) {
				await deps.calendars.save({ ...calendar, readOnly, updatedAt: now });
			}
			active.push(link);
		}
		await deps.googleSync.saveCalendar(link);
	}

	for (const link of existing.values()) {
		if (listed.has(link.googleId)) continue;
		await detachGoogleCalendar(deps, link, now);
		await deps.googleSync.deleteCalendar(link.googleId);
	}
	return active;
};

type PullCounts = { pulled: number; skipped: number };

/** Soft-deletes a local event pulled as deleted, with a series' edited occurrences, and forgets their links. */
const removeLocal = async (deps: SyncDeps, event: CalendarEvent, now: string): Promise<void> => {
	const related = event.rrule === null ? [] : await deps.events.listBySeries(event.id);
	for (const item of [event, ...related]) {
		if (item.deletedAt === null) await deps.events.save({ ...item, deletedAt: now, updatedAt: now });
		await deps.googleSync.deleteEventLink(item.id);
	}
};

/** Adds `date` to a series' skipped dates without touching `updatedAt`, so whether it has changes to push stays as is. */
const skipDate = async (deps: SyncDeps, series: CalendarEvent, date: string): Promise<CalendarEvent> => {
	if (series.exDates.includes(date)) return series;
	const updated = { ...series, exDates: [...series.exDates, date].sort() };
	await deps.events.save(updated);
	return updated;
};

/** Applies the events Google returned for one calendar. A full pull also removes linked events Google no longer has. */
const applyPull = async (deps: SyncDeps, link: GoogleCalendarLink & { calendarId: string }, items: GoogleEvent[], full: boolean): Promise<PullCounts> => {
	const counts: PullCounts = { pulled: 0, skipped: 0 };
	const now = deps.clock.now().toISOString();
	const seen = new Set<string>();

	/** The local event linked to a Google event, and its link, unless Google is only echoing Tempi's own last write. */
	const linked = async (item: GoogleEvent) => {
		const eventLink = await deps.googleSync.findEventLinkByGoogleId(link.googleId, item.id);
		const local = eventLink === null ? null : await deps.events.findById(eventLink.eventId);
		return { echo: eventLink !== null && eventLink.etag === item.etag, eventLink, local };
	};

	/** Writes the pulled version over the local one, unless the local one changed later (latest `updatedAt` wins). */
	const write = async (item: GoogleEvent, local: CalendarEvent | null, eventLink: GoogleEventLink | null, build: (updatedAt: string) => unknown): Promise<CalendarEvent | null> => {
		const updatedAt = remoteUpdated(item, now);
		if (local !== null && eventLink !== null && isPending(local, eventLink) && local.updatedAt >= updatedAt) return null;
		const fields = eventFieldsSchema.safeParse(build(updatedAt));
		// Google always sends an etag; without one, Tempi couldn't tell its own echo from a newer edit.
		if (!fields.success || item.etag === undefined) {
			counts.skipped += 1;
			return null;
		}
		const event: CalendarEvent = { ...fields.data, createdAt: local?.createdAt ?? updatedAt, deletedAt: null, id: local?.id ?? deps.ids.next(), updatedAt };
		await deps.events.save(event);
		await deps.googleSync.saveEventLink({ etag: item.etag, eventId: event.id, googleCalendarId: link.googleId, googleEventId: item.id, meet: hasMeet(item), syncedUpdatedAt: updatedAt });
		counts.pulled += 1;
		return event;
	};

	const deleteRemoved = async (item: GoogleEvent, local: CalendarEvent | null, eventLink: GoogleEventLink | null) => {
		if (local === null || eventLink === null) return;
		// A local edit newer than the deletion wins: it is pushed back, which restores the event on Google.
		if (local.deletedAt === null && isPending(local, eventLink) && local.updatedAt >= remoteUpdated(item, now)) return;
		await removeLocal(deps, local, now);
		counts.pulled += 1;
	};

	const applySingleOrSeries = async (item: GoogleEvent, pulled: PulledFields | null, asSingle: boolean) => {
		const { echo, eventLink, local } = await linked(item);
		if (echo) return;
		if (item.status === 'cancelled') return deleteRemoved(item, local, eventLink);
		if (pulled === null) {
			counts.skipped += 1;
			return;
		}
		const rrule = asSingle ? null : pulled.rrule;
		const sameRule = local !== null && local.rrule !== null && local.rrule.replace(/^RRULE:/i, '') === rrule?.replace(/^RRULE:/i, '') && local.startAt === pulled.startAt;
		// Google lists cancelled and edited occurrences as their own items, not in EXDATE: keep the ones already known.
		const known = local === null ? [] : sameRule ? local.exDates : (await deps.events.listBySeries(local.id)).flatMap(edited => edited.originalStartAt ?? []);
		const exDates = rrule === null ? [] : [...new Set([...known, ...pulled.exDates])].sort();
		await write(item, local, eventLink, () => ({
			...pulled,
			calendarId: link.calendarId,
			exDates,
			icalUid: local?.icalUid ?? null,
			originalStartAt: null,
			recurringEventId: null,
			rrule,
		}));
	};

	const applyException = async (item: GoogleEvent, seriesGoogleId: string) => {
		const seriesLink = await deps.googleSync.findEventLinkByGoogleId(link.googleId, seriesGoogleId);
		const series = seriesLink === null ? null : await deps.events.findById(seriesLink.eventId);
		// An occurrence whose series isn't here (e.g. a single invitation) is an event of its own.
		if (series === null || series.deletedAt !== null || series.rrule === null) return applySingleOrSeries(item, fromGoogle(item, link.timeZone), true);

		const original = item.originalStartTime === undefined ? null : instantOf(item.originalStartTime, series.timeZone);
		if (original === null) {
			counts.skipped += 1;
			return;
		}
		const { echo, eventLink, local } = await linked(item);
		if (echo) return;
		const withSkip = await skipDate(deps, series, original.instant);
		if (item.status === 'cancelled') {
			if (local !== null && eventLink !== null) await deleteRemoved(item, local, eventLink);
			else counts.pulled += withSkip === series ? 0 : 1;
			return;
		}
		const pulled = fromGoogle(item, series.timeZone);
		if (pulled === null) {
			counts.skipped += 1;
			return;
		}
		await write(item, local, eventLink, () => ({
			...pulled,
			calendarId: link.calendarId,
			exDates: [],
			icalUid: null,
			originalStartAt: original.instant,
			recurringEventId: series.id,
			rrule: null,
		}));
	};

	// Series before their exceptions, so an exception always finds its series.
	for (const item of items.filter(item => item.recurringEventId === undefined)) {
		seen.add(item.id);
		await applySingleOrSeries(item, fromGoogle(item, link.timeZone), false);
	}
	for (const item of items) {
		if (item.recurringEventId === undefined) continue;
		seen.add(item.id);
		await applyException(item, item.recurringEventId);
	}

	if (full) {
		for (const eventLink of await deps.googleSync.listEventLinks(link.googleId)) {
			if (seen.has(eventLink.googleEventId)) continue;
			const local = await deps.events.findById(eventLink.eventId);
			if (local === null || (local.deletedAt === null && isPending(local, eventLink))) continue;
			await removeLocal(deps, local, now);
			counts.pulled += 1;
		}
	}
	return counts;
};

/** Every change since `syncToken` (deleted events included), or every event when it is null, with the next token. */
const listEvents = async (api: GoogleCalendarClient, calendarId: string, syncToken: string | null): Promise<{ items: GoogleEvent[]; nextSyncToken: string }> => {
	const page = await api.events.list(calendarId, syncToken === null ? { showDeleted: true } : { showDeleted: true, syncToken });
	if (page.nextSyncToken === null) throw new Error(`The last page of ${calendarId} has no sync token`);
	return { items: page.items, nextSyncToken: page.nextSyncToken };
};

/** Pulls one calendar's changes since its sync token (all of them on the first pull, or when Google expired the token). */
const pullCalendar = async (options: GoogleSyncOptions, link: GoogleCalendarLink & { calendarId: string }): Promise<PullCounts> => {
	let full = link.syncToken === null;
	let page: Awaited<ReturnType<typeof listEvents>>;
	try {
		page = await listEvents(options.api, link.googleId, link.syncToken);
	} catch (error) {
		if (!isMeshlyError(error, 'sync_token_expired')) throw error;
		full = true;
		page = await listEvents(options.api, link.googleId, null);
	}
	return options.transact(async deps => {
		// The selection may have changed while Google answered.
		const current = (await deps.googleSync.listCalendars()).find(candidate => candidate.googleId === link.googleId);
		if (current === undefined || !current.selected || current.calendarId !== link.calendarId) return { pulled: 0, skipped: 0 };
		const counts = await applyPull(deps, link, page.items, full);
		await deps.googleSync.saveCalendar({ ...current, syncToken: page.nextSyncToken });
		return counts;
	});
};

/** A local change to send, with what deciding where it goes needs. */
type Push = {
	event: CalendarEvent;
	link: GoogleEventLink | null;
	/** For an edited occurrence: its series. */
	series: CalendarEvent | null;
	/** For a series: the dates it skips that aren't edited occurrences. */
	exDates: string[];
};

const planPushes = async (deps: SyncDeps, calendarIds: string[]): Promise<Push[]> => {
	const pending = await deps.googleSync.listPendingEvents(calendarIds);
	const pushes: Push[] = [];
	for (const event of pending) {
		const link = await deps.googleSync.findEventLink(event.id);
		if (event.recurringEventId !== null) {
			pushes.push({ event, exDates: [], link, series: await deps.events.findById(event.recurringEventId) });
			continue;
		}
		const edited = new Set(event.rrule === null ? [] : (await deps.events.listBySeries(event.id)).map(override => override.originalStartAt));
		pushes.push({ event, exDates: event.exDates.filter(date => !edited.has(date)), link, series: null });
	}
	return pushes;
};

const isGone = (error: unknown) => isMeshlyError(error) && (error.status === 404 || error.status === 410);

/** Sends one local change to Google and records what Google answered. Returns whether anything was sent. */
const push = async (options: GoogleSyncOptions, { event, exDates, link, series }: Push, targets: Map<string, GoogleCalendarLink>, readOnly: Set<string>): Promise<boolean> => {
	const { api, transact } = options;
	const target = targets.get(event.calendarId);
	// Google would refuse any write there; the next pull brings back Google's version.
	if (link !== null && readOnly.has(link.googleCalendarId)) return false;
	const record = (googleCalendarId: string, sent: GoogleEvent) => {
		const { etag } = sent;
		if (etag === undefined) throw new Error(`Google answered ${sent.id} without an etag`);
		return transact(async deps => {
			await deps.googleSync.saveEventLink({ etag, eventId: event.id, googleCalendarId, googleEventId: sent.id, meet: hasMeet(sent), syncedUpdatedAt: event.updatedAt });
			// Pulls skip Tempi's own writes, so the Meet link Google just made is copied here, without counting as a local
			// change. A pending Meet has no link yet: it arrives with the pull after Google finishes it.
			const meetLink = event.googleMeet ? meetLinkOf(sent) : null;
			const current = meetLink === null ? null : await deps.events.findById(event.id);
			if (current !== null && current.updatedAt === event.updatedAt && current.videoUrl !== meetLink) await deps.events.save({ ...current, videoUrl: meetLink });
		});
	};
	const forget = () => transact(deps => deps.googleSync.deleteEventLink(event.id));

	// Deleted here, or moved out of the Google calendar it was on: delete it there.
	if (link !== null && (event.deletedAt !== null || target?.googleId !== link.googleCalendarId)) {
		await api.events.delete(link.googleCalendarId, link.googleEventId);
		await forget();
		if (event.deletedAt !== null || target === undefined) return true;
		link = null;
	}
	if (event.deletedAt !== null || target === undefined) return false;

	if (event.recurringEventId !== null) {
		// An edited occurrence lives on Google as an instance of its series, which must be there first (maybe pushed just now).
		const seriesLink = await transact(deps => deps.googleSync.findEventLink(event.recurringEventId ?? ''));
		if (series === null || seriesLink === null || seriesLink.googleCalendarId !== target.googleId || event.originalStartAt === null) return false;
		const id = link?.googleEventId ?? instanceId(seriesLink.googleEventId, event.originalStartAt, series.allDay, series.timeZone);
		// An occurrence edited for the first time shares its series' Meet on Google.
		await record(target.googleId, await api.events.patch(target.googleId, id, toGoogle(event, [], link?.meet ?? seriesLink.meet)));
		return true;
	}

	const body = toGoogle(event, exDates, link?.meet ?? false);
	if (link !== null) {
		try {
			await record(target.googleId, await api.events.patch(target.googleId, link.googleEventId, body));
			return true;
		} catch (error) {
			if (!isGone(error)) throw error;
		}
	}
	const id = googleEventIdFor(event.id);
	try {
		await record(target.googleId, await api.events.insert(target.googleId, id === undefined ? body : { ...body, id }));
	} catch (error) {
		// The id is already taken: an earlier insert went through, or the event was deleted there and is coming back.
		if (!isMeshlyError(error, 'conflict') || id === undefined) throw error;
		await record(target.googleId, await api.events.patch(target.googleId, id, body));
	}
	return true;
};

/**
 * One two-way sync with Google Calendar: refreshes the list of calendars, pulls each selected calendar's changes
 * (the latest `updatedAt` wins a conflict), then pushes local creates, updates and deletes in writable calendars.
 * Throws what the API throws (a `MeshlyError` such as `network_error` or `unauthorized`); what was applied before stays applied.
 */
export const syncGoogle = async (options: GoogleSyncOptions): Promise<SyncSummary> => {
	const { items: entries } = await options.api.calendarList.list({ minAccessRole: 'reader' });
	const active = await options.transact(deps => reconcileCalendars(deps, entries));
	const summary: SyncSummary = { pulled: 0, pushed: 0, skipped: 0 };

	for (const link of active) {
		if (link.calendarId === null) continue;
		const counts = await pullCalendar(options, { ...link, calendarId: link.calendarId });
		summary.pulled += counts.pulled;
		summary.skipped += counts.skipped;
	}

	const targets = new Map(active.flatMap(link => (link.calendarId !== null && isWritableRole(link.accessRole) ? [[link.calendarId, link] as const] : [])));
	const readOnly = new Set(active.filter(link => !isWritableRole(link.accessRole)).map(link => link.googleId));
	const pushes = await options.transact(deps => planPushes(deps, [...targets.keys()]));
	for (const change of pushes) {
		if (await push(options, change, targets, readOnly)) summary.pushed += 1;
	}
	return summary;
};
