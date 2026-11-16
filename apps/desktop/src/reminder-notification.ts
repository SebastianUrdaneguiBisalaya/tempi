import type { Language, Reminder, TimeFormat } from '@tempi/core';

export type ReminderDisplay = { language: Language; timeFormat: TimeFormat; timeZone: string };

/**
 * A reminder's notification text: the event title, and when (plus where) it happens. Only Intl formatting, so it is
 * already in the user's language with no strings to translate. An all-day event shows its date in its own zone; a
 * timed one its times in the user's, with the day too when it isn't the day the reminder fires.
 */
export const reminderContent = ({ fireAt, occurrence }: Reminder, { language, timeFormat, timeZone }: ReminderDisplay): { body: string; title: string } => {
	const start = new Date(occurrence.startAt);
	let when: string;
	if (occurrence.allDay) {
		when = new Intl.DateTimeFormat(language, { dateStyle: 'full', timeZone: occurrence.timeZone }).format(start);
	} else {
		const day = (instant: string) => Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone).toPlainDate();
		const sameDay = day(fireAt).equals(day(occurrence.startAt));
		when = new Intl.DateTimeFormat(language, {
			hour: 'numeric',
			hourCycle: timeFormat === '12h' ? 'h12' : 'h23',
			minute: '2-digit',
			timeZone,
			...(sameDay ? {} : { day: 'numeric', month: 'short', weekday: 'short' }),
		}).formatRange(start, new Date(occurrence.endAt));
	}
	return { body: occurrence.location === null ? when : `${when} · ${occurrence.location}`, title: occurrence.title };
};
