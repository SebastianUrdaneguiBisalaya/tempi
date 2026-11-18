/** How far ahead upcoming events are looked for. */
export const UPCOMING_WINDOW_HOURS = 24;

type UpcomingItem = { allDay: boolean; calendarId: string; endAt: string; startAt: string };

const byStartThenEnd = (a: UpcomingItem, b: UpcomingItem): number =>
	Temporal.Instant.compare(Temporal.Instant.from(a.startAt), Temporal.Instant.from(b.startAt)) || Temporal.Instant.compare(Temporal.Instant.from(a.endAt), Temporal.Instant.from(b.endAt));

/**
 * The events to show as upcoming at `now`: timed events of visible calendars in progress or starting within the
 * window, the soonest first (ties on start go to the earlier end). An event in progress stays until it ends. All-day
 * events never count: they don't start at a moment worth counting down to.
 */
export const upcomingEvents = <T extends UpcomingItem>(events: readonly T[], now: Temporal.Instant, hiddenCalendarIds: ReadonlySet<string>): T[] => {
	const horizon = now.add({ hours: UPCOMING_WINDOW_HOURS });
	return events
		.filter(
			event =>
				!event.allDay &&
				!hiddenCalendarIds.has(event.calendarId) &&
				Temporal.Instant.compare(Temporal.Instant.from(event.endAt), now) > 0 &&
				Temporal.Instant.compare(Temporal.Instant.from(event.startAt), horizon) < 0
		)
		.sort(byStartThenEnd);
};
