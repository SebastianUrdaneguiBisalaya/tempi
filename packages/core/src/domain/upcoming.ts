/** How far ahead the upcoming event is looked for. */
export const UPCOMING_WINDOW_DAYS = 7;

type UpcomingItem = { allDay: boolean; calendarId: string; endAt: string; startAt: string };

/**
 * The event to show as "up next" at `now`: the timed event of a visible calendar that is in progress or starts first
 * within the window. An event in progress stays until it ends, then the next one takes its place. All-day events
 * never count: they don't start at a moment worth counting down to.
 */
export const upcomingEvent = <T extends UpcomingItem>(events: readonly T[], now: Temporal.Instant, hiddenCalendarIds: ReadonlySet<string>): T | null => {
	const horizon = now.add({ hours: UPCOMING_WINDOW_DAYS * 24 });
	let next: T | null = null;
	for (const event of events) {
		if (event.allDay || hiddenCalendarIds.has(event.calendarId)) continue;
		const start = Temporal.Instant.from(event.startAt);
		if (Temporal.Instant.compare(Temporal.Instant.from(event.endAt), now) <= 0 || Temporal.Instant.compare(start, horizon) >= 0) continue;
		if (next === null) {
			next = event;
			continue;
		}
		const order = Temporal.Instant.compare(start, Temporal.Instant.from(next.startAt)) || Temporal.Instant.compare(Temporal.Instant.from(event.endAt), Temporal.Instant.from(next.endAt));
		if (order < 0) next = event;
	}
	return next;
};
