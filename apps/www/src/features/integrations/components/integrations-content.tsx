'use client';

import { ShowcaseCell, ShowcaseGrid, ShowcaseSection } from '@/components/showcase';
import type { Locale } from '@/lib/i18n';
import type { EventKey } from '@/lib/sample-calendar';
import { SECTION_IDS } from '@/lib/site';
import { type HolidayWeekCopy, HolidayWeekReplica } from './holiday-week-replica';
import { type WeatherCardCopy, WeatherCardReplica } from './weather-card-replica';

type Point = { title: string; body: string };

export type IntegrationsCopy = {
	eyebrow: string;
	title: string;
	subtitle: string;
	points: Record<'weather' | 'holidays', Point>;
	weather: WeatherCardCopy;
	week: HolidayWeekCopy;
};

type IntegrationsContentProps = {
	locale: Locale;
	copy: IntegrationsCopy;
	/** The hero's sample event titles, so the week reads the same events. */
	events: Record<EventKey, string>;
};

export function IntegrationsContent({ locale, copy, events }: IntegrationsContentProps) {
	const { points } = copy;
	return (
		<ShowcaseSection id={SECTION_IDS.integrations} index={4} eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle}>
			<ShowcaseGrid>
				<ShowcaseCell align='center' title={points.weather.title} body={points.weather.body}>
					<WeatherCardReplica locale={locale} copy={copy.weather} />
				</ShowcaseCell>
				<ShowcaseCell align='center' title={points.holidays.title} body={points.holidays.body}>
					<HolidayWeekReplica locale={locale} copy={copy.week} events={events} />
				</ShowcaseCell>
			</ShowcaseGrid>
		</ShowcaseSection>
	);
}
