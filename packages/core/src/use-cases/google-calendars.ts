import type { GoogleCalendarChoice, GoogleCalendarLink, SelectGoogleCalendarsInput } from '../domain/google-sync';
import { selectGoogleCalendarsInputSchema } from '../domain/google-sync';
import { ok, parseWith, type Result } from '../domain/result';
import { type CoreDeps, nowIso } from './deps';

type Deps = Pick<CoreDeps, 'calendars' | 'clock' | 'events' | 'googleSync'>;

/** Google calendars to pick from, as the last sync listed them: primary first, then by name. */
export const listGoogleCalendars = async (deps: Pick<CoreDeps, 'googleSync'>): Promise<GoogleCalendarChoice[]> => {
	const links = await deps.googleSync.listCalendars();
	return links
		.map(({ accessRole, color, googleId, name, primary, selected }) => ({ accessRole, color, googleId, name, primary, selected }))
		.sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name));
};

/**
 * Stops syncing a Google calendar: its local calendar and events are deleted from Tempi (Google keeps them) and its
 * links forgotten, so selecting it again pulls everything anew. Another calendar becomes the default if it was.
 */
export const detachGoogleCalendar = async (deps: Deps, link: GoogleCalendarLink, now: string): Promise<void> => {
	if (link.calendarId !== null) {
		const calendar = await deps.calendars.findById(link.calendarId);
		if (calendar !== null && calendar.deletedAt === null) {
			await deps.events.softDeleteByCalendar(calendar.id, now);
			await deps.calendars.save({ ...calendar, deletedAt: now, isDefault: false, updatedAt: now });
			if (calendar.isDefault) {
				const [next] = (await deps.calendars.list()).sort((a, b) => Number(a.source !== 'local') - Number(b.source !== 'local'));
				if (next !== undefined) await deps.calendars.save({ ...next, isDefault: true, updatedAt: now });
			}
		}
	}
	await deps.googleSync.deleteEventLinks(link.googleId);
};

/** Chooses which Google calendars sync. Unselected ones leave Tempi now; newly selected ones arrive with the next sync. */
export const selectGoogleCalendars = async (deps: Deps, input: SelectGoogleCalendarsInput): Promise<Result<GoogleCalendarChoice[]>> => {
	const parsed = parseWith(selectGoogleCalendarsInputSchema, input);
	if (!parsed.ok) return parsed;
	const chosen = new Set(parsed.value.googleIds);
	const now = nowIso(deps.clock);
	for (const link of await deps.googleSync.listCalendars()) {
		const selected = chosen.has(link.googleId);
		if (selected === link.selected) continue;
		if (!selected) await detachGoogleCalendar(deps, link, now);
		await deps.googleSync.saveCalendar(selected ? { ...link, selected } : { ...link, calendarId: null, selected, syncToken: null });
	}
	return ok(await listGoogleCalendars(deps));
};

/** After the account is disconnected: removes every Google calendar and its events from Tempi and forgets the links. */
export const disconnectGoogleCalendars = async (deps: Deps): Promise<Result<null>> => {
	const now = nowIso(deps.clock);
	for (const link of await deps.googleSync.listCalendars()) await detachGoogleCalendar(deps, link, now);
	await deps.googleSync.clear();
	return ok(null);
};
