import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Locale } from '@/lib/i18n';
import { WORKING_HOURS, weekStartFor } from '@/lib/sample-calendar';

// 2024-01-01 was a Monday, so day N of that week has ISO weekday N.
const weekdayName = (day: number, locale: Locale, width: 'long' | 'short') => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: width }).format(Date.UTC(2024, 0, day));

/** The app's `WeekdayToggleGroup`: one toggle per weekday in the week's order, Monday to Friday pressed. */
export function WeekdayToggles({ locale }: { locale: Locale }) {
	const weekdays = Array.from({ length: 7 }, (_, offset) => (((weekStartFor(locale) === 0 ? 6 : 0) + offset) % 7) + 1);
	return (
		<ToggleGroup className='flex-wrap' multiple size='sm' value={WORKING_HOURS.days.map(String)} variant='outline'>
			{weekdays.map(day => (
				<ToggleGroupItem key={day} aria-label={weekdayName(day, locale, 'long')} value={String(day)}>
					{weekdayName(day, locale, 'short')}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
