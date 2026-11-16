'use client';

import { useMinute } from '../../hooks/use-minute';
import { boxStyle } from './grid-geometry';

/** Red line at the current time across today's column. Decorative: the time is in the header and the clock. */
export function CurrentTimeLine({ dayCount, dayIndex, timeZone }: { dayCount: number; dayIndex: number; timeZone: string }) {
	const now = useMinute();
	if (now === null) return null;

	const time = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(timeZone);
	const minute = time.hour * 60 + time.minute;
	return (
		<div aria-hidden className='pointer-events-none absolute z-[6] h-0' style={{ ...boxStyle(dayIndex, dayCount, minute, minute), height: undefined }}>
			<div className='absolute inset-x-0 -top-px h-0.5 bg-destructive' />
			<div className='absolute -top-1.5 -left-1.5 size-3 rounded-full bg-destructive' />
		</div>
	);
}
