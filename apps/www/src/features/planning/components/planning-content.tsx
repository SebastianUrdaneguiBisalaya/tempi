'use client';

import type { SettingsTab } from '@/components/settings-replica';
import { ShowcaseCell, ShowcaseGrid, ShowcaseSection } from '@/components/showcase';
import { Hotkey } from '@/features/keyboard/components/hotkey';
import { SHOWN_SHORTCUTS } from '@/lib/hotkeys';
import type { Locale } from '@/lib/i18n';
import { SECTION_IDS } from '@/lib/site';
import { type AvailabilityCopy, AvailabilityReplica } from './availability-replica';
import { type SecondaryZonesCopy, SecondaryZonesReplica } from './secondary-zones-replica';
import { type SampleCopy, type StatsCopy, StatsReplica } from './stats-replica';
import { type WorkingHoursCopy, WorkingHoursReplica } from './working-hours-replica';

type Point = { title: string; body: string };

export type PlanningCopy = {
	eyebrow: string;
	title: string;
	subtitle: string;
	points: Record<'workingHours' | 'timeZones' | 'availability' | 'stats', Point>;
	shortcut: string;
	replicas: { workingHours: WorkingHoursCopy; secondaryTimeZones: SecondaryZonesCopy };
	availability: AvailabilityCopy;
	stats: StatsCopy;
};

type PlanningContentProps = {
	locale: Locale;
	copy: PlanningCopy;
	/** The hero's sample calendars and events, and the settings dialog's tab names. */
	sample: SampleCopy;
	settingsTabs: Record<SettingsTab, string>;
};

export function PlanningContent({ locale, copy, sample, settingsTabs }: PlanningContentProps) {
	const { points, replicas } = copy;
	return (
		<ShowcaseSection id={SECTION_IDS.planning} index={3} eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle}>
			<ShowcaseGrid>
				<ShowcaseCell align='center' title={points.workingHours.title} body={points.workingHours.body}>
					<WorkingHoursReplica locale={locale} copy={replicas.workingHours} tabs={settingsTabs} />
				</ShowcaseCell>
				<ShowcaseCell align='center' title={points.timeZones.title} body={points.timeZones.body}>
					<SecondaryZonesReplica locale={locale} copy={replicas.secondaryTimeZones} tabs={settingsTabs} />
				</ShowcaseCell>
				<ShowcaseCell title={points.availability.title} body={points.availability.body}>
					<AvailabilityReplica locale={locale} copy={copy.availability} calendars={sample.calendars} />
				</ShowcaseCell>
				<ShowcaseCell title={points.stats.title} body={points.stats.body}>
					<StatsReplica locale={locale} copy={copy.stats} sample={sample} />
				</ShowcaseCell>
			</ShowcaseGrid>
			<div className='border-b py-12 md:px-8'>
				<p className='flex flex-wrap items-center justify-center gap-2 text-sm text-foreground/70'>
					{copy.shortcut}
					<Hotkey keys={SHOWN_SHORTCUTS.openCommandMenu} />
				</p>
			</div>
		</ShowcaseSection>
	);
}
