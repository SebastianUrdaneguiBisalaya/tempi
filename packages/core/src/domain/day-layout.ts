export const MINUTES_PER_DAY = 24 * 60;

type TimedItem = { endAt: string; id: string; startAt: string };

/** Where an item sits in one day column: minutes from midnight (wall clock in the time zone) and its lane. */
export type DaySegment<T extends TimedItem> = {
	/** Lane index among `columns` lanes shared by the items it overlaps with. */
	column: number;
	columns: number;
	/** Exclusive; `MINUTES_PER_DAY` when the item runs past midnight. */
	endMinute: number;
	/** The item started on an earlier day. */
	continuesBefore: boolean;
	/** The item ends on a later day. */
	continuesAfter: boolean;
	item: T;
	startMinute: number;
};

const minuteOfDay = (time: Temporal.ZonedDateTime): number => time.hour * 60 + time.minute;

/**
 * Lays out the items that overlap `day` in `timeZone`, clipped to the day. Items that overlap in time share the
 * width side by side, like Google Calendar: each group of transitively overlapping items gets as many lanes as
 * it needs at once, and each item takes the first free lane.
 *
 * `minMinutes` is the shortest height the UI draws, so items that are short in time but drawn taller don't cover
 * the next one.
 */
export const layoutDay = <T extends TimedItem>(items: readonly T[], day: Temporal.PlainDate, timeZone: string, minMinutes = 15): DaySegment<T>[] => {
	const dayStart = day.toZonedDateTime({ timeZone });
	const dayEnd = day.add({ days: 1 }).toZonedDateTime({ timeZone });

	const segments = items.flatMap(item => {
		const start = Temporal.Instant.from(item.startAt).toZonedDateTimeISO(timeZone);
		const end = Temporal.Instant.from(item.endAt).toZonedDateTimeISO(timeZone);
		if (Temporal.ZonedDateTime.compare(end, dayStart) <= 0 || Temporal.ZonedDateTime.compare(start, dayEnd) >= 0) return [];

		const continuesBefore = Temporal.ZonedDateTime.compare(start, dayStart) < 0;
		const continuesAfter = Temporal.ZonedDateTime.compare(end, dayEnd) > 0;
		const startMinute = continuesBefore ? 0 : minuteOfDay(start);
		const endMinute = Temporal.ZonedDateTime.compare(end, dayEnd) >= 0 ? MINUTES_PER_DAY : minuteOfDay(end);
		// A wall-clock end can fall before the start across a DST change; keep the item visible.
		return [{ continuesAfter, continuesBefore, endMinute: Math.max(endMinute, startMinute + 1), item, startMinute }];
	});

	// Earlier first; on ties the longer item takes the left lane.
	segments.sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute || a.item.id.localeCompare(b.item.id));

	const visibleEnd = (segment: { endMinute: number; startMinute: number }) => Math.min(MINUTES_PER_DAY, Math.max(segment.endMinute, segment.startMinute + minMinutes));

	const laidOut: DaySegment<T>[] = [];
	let group: DaySegment<T>[] = [];
	let laneEnds: number[] = [];
	let groupEnd = -1;

	const closeGroup = () => {
		for (const segment of group) segment.columns = laneEnds.length;
		laidOut.push(...group);
		group = [];
		laneEnds = [];
	};

	for (const segment of segments) {
		if (segment.startMinute >= groupEnd) closeGroup();
		const end = visibleEnd(segment);
		const free = laneEnds.findIndex(laneEnd => laneEnd <= segment.startMinute);
		const column = free === -1 ? laneEnds.length : free;
		laneEnds[column] = end;
		groupEnd = Math.max(groupEnd, end);
		group.push({ ...segment, column, columns: 0 });
	}
	closeGroup();

	return laidOut;
};
