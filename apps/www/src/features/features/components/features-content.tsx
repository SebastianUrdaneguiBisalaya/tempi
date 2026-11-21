'use client';

import type { SettingsTab } from '@/components/settings-replica';
import { ShowcaseCell, ShowcaseGrid, ShowcaseSection } from '@/components/showcase';
import type { MockupCopy } from '@/features/why/components/app-mockup';
import { type GoogleCardCopy, type GoogleSyncCopy, GoogleSyncReplica } from '@/features/why/components/google-sync-replica';
import type { ShownShortcut } from '@/lib/hotkeys';
import type { Locale } from '@/lib/i18n';
import { SECTION_IDS } from '@/lib/site';
import { type AppearanceCopy, AppearanceReplica } from './appearance-replica';
import { type CalendarsCopy, CalendarsReplica } from './calendars-replica';
import { type EventPreviewCopy, EventPreviewReplica } from './event-preview-replica';
import { type ImportExportCopy, ImportExportReplica } from './import-export-replica';
import { type QuickAddCopy, QuickAddReplica } from './quick-add-replica';
import { type RecurrenceCopy, RecurrenceReplica } from './recurrence-replica';
import { ShortcutsReplica } from './shortcuts-replica';
import { type TimeZonesCopy, TimeZonesReplica } from './time-zones-replica';
import { TrayReplica } from './tray-replica';
import { type UpdatesCopy, UpdatesReplica } from './updates-replica';
import { ViewsReplica } from './views-replica';

// `badge` and `note` flag a feature that isn't open to everyone yet (Google sync while Google reviews the app).
type Feature = { title: string; body: string; badge?: string; note?: string };

// Only what Tempi ships today (see the README feature list and the command menu's quick add).
type FeatureKey = 'views' | 'calendars' | 'googleSync' | 'recurrence' | 'timeZones' | 'meetings' | 'quickAdd' | 'importExport' | 'tray' | 'keyboard' | 'languages' | 'updates';

export type FeaturesCopy = {
	eyebrow: string;
	title: string;
	subtitle: string;
	items: Record<FeatureKey, Feature>;
	replicas: {
		calendars: CalendarsCopy;
		recurrence: RecurrenceCopy;
		meetings: EventPreviewCopy;
		quickAdd: QuickAddCopy;
		timeZones: TimeZonesCopy;
		importExport: ImportExportCopy;
		appearance: AppearanceCopy;
		updates: UpdatesCopy;
		shortcutsTitle: string;
	};
};

/** Names shared with other sections, so every replica calls things the same. */
export type SharedCopy = {
	mockup: MockupCopy;
	settingsTabs: Record<SettingsTab, string>;
	google: { card: GoogleCardCopy; sync: GoogleSyncCopy };
	shortcuts: { groups: Record<'navigation' | 'views' | 'general', string>; actions: Record<ShownShortcut, string> };
};

type FeaturesContentProps = {
	locale: Locale;
	copy: FeaturesCopy;
	shared: SharedCopy;
};

export function FeaturesContent({ locale, copy, shared }: FeaturesContentProps) {
	const { items, replicas } = copy;
	const { mockup } = shared;
	// Each cell's badge and note show only where the feature has them.
	const cell = (key: FeatureKey) => ({ title: items[key].title, body: items[key].body, badge: items[key].badge, note: items[key].note });

	return (
		<ShowcaseSection id={SECTION_IDS.features} index={2} eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle}>
			<ShowcaseGrid>
				<ShowcaseCell align='center' {...cell('views')}>
					<ViewsReplica labels={mockup.views} />
				</ShowcaseCell>
				<ShowcaseCell align='center' {...cell('calendars')}>
					<CalendarsReplica copy={replicas.calendars} mockup={mockup} />
				</ShowcaseCell>
				<ShowcaseCell {...cell('googleSync')}>
					<GoogleSyncReplica card={shared.google.card} copy={shared.google.sync} />
				</ShowcaseCell>
				<ShowcaseCell align='center' {...cell('recurrence')}>
					<RecurrenceReplica locale={locale} copy={replicas.recurrence} title={mockup.events.standup} />
				</ShowcaseCell>
				<ShowcaseCell {...cell('timeZones')}>
					<TimeZonesReplica locale={locale} copy={replicas.timeZones} />
				</ShowcaseCell>
				<ShowcaseCell align='center' {...cell('meetings')}>
					<EventPreviewReplica locale={locale} copy={replicas.meetings} title={mockup.events.teamSync} calendarName={mockup.calendars.work} />
				</ShowcaseCell>
				<ShowcaseCell align='center' {...cell('quickAdd')}>
					<QuickAddReplica locale={locale} copy={replicas.quickAdd} />
				</ShowcaseCell>
				<ShowcaseCell align='center' {...cell('importExport')}>
					<ImportExportReplica copy={replicas.importExport} calendars={mockup.calendars} />
				</ShowcaseCell>
				<ShowcaseCell align='center' {...cell('tray')}>
					<TrayReplica locale={locale} today={mockup.today} events={mockup.events} />
				</ShowcaseCell>
				<ShowcaseCell align='center' {...cell('keyboard')}>
					<ShortcutsReplica title={replicas.shortcutsTitle} groups={shared.shortcuts.groups} actions={shared.shortcuts.actions} />
				</ShowcaseCell>
				<ShowcaseCell align='center' {...cell('languages')}>
					<AppearanceReplica locale={locale} copy={replicas.appearance} tabs={shared.settingsTabs} />
				</ShowcaseCell>
				<ShowcaseCell align='center' {...cell('updates')}>
					<UpdatesReplica copy={replicas.updates} tabs={shared.settingsTabs} />
				</ShowcaseCell>
			</ShowcaseGrid>
		</ShowcaseSection>
	);
}
