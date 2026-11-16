import type { EventDraft } from '@/features/events/components/event-panel-provider';

const SLOT_MINUTES = 30;

/** A new timed event starting `minute` minutes into `day` (wall clock in `timeZone`), lasting `duration` minutes. */
export const draftAt = (day: Temporal.PlainDate, minute: number, timeZone: string, duration: number): EventDraft => {
	const start = day.toZonedDateTime({ plainTime: Temporal.PlainTime.from({ hour: Math.floor(minute / 60), minute: minute % 60 }), timeZone });
	return { allDay: false, endAt: start.add({ minutes: duration }).toInstant().toString(), startAt: start.toInstant().toString() };
};

/** The `C` shortcut's event: the next half hour when viewing today, else 9:00 on the viewed day. */
export const nextDraft = (day: Temporal.PlainDate, timeZone: string, duration: number): EventDraft => {
	const now = Temporal.Now.zonedDateTimeISO(timeZone);
	if (!day.equals(now.toPlainDate())) return draftAt(day, 9 * 60, timeZone, duration);
	const minute = Math.ceil((now.hour * 60 + now.minute + 1) / SLOT_MINUTES) * SLOT_MINUTES;
	// Past 23:30 the next half hour is tomorrow.
	return minute >= 24 * 60 ? draftAt(day.add({ days: 1 }), 0, timeZone, duration) : draftAt(day, minute, timeZone, duration);
};
