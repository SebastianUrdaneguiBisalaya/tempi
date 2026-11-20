'use client';

import type { SettingsTab } from '@/components/settings-replica';
import { ShowcaseCell, ShowcaseGrid, ShowcaseSection } from '@/components/showcase';
import type { Locale } from '@/lib/i18n';
import { SECTION_IDS } from '@/lib/site';
import type { MockupCopy } from './app-mockup';
import { type DataSettingsCopy, DataSettingsReplica } from './data-settings-replica';
import { EventRecordReplica } from './event-record-replica';
import { type EventSearchCopy, EventSearchReplica } from './event-search-replica';
import { type GoogleCardCopy, GoogleConnectReplica, type GoogleSyncCopy } from './google-sync-replica';

type Pillar = { title: string; body: string };

export type WhyCopy = {
	eyebrow: string;
	title: string;
	subtitle: string;
	pillars: Record<'local' | 'fast' | 'sync' | 'lasting', Pillar>;
	/** Also read by Features, whose replicas share the settings dialog and the Google card. */
	replicas: {
		settingsTabs: Record<SettingsTab, string>;
		data: DataSettingsCopy;
		search: EventSearchCopy;
		google: { card: GoogleCardCopy; sync: GoogleSyncCopy };
	};
	/** Rendered by the hero; the replicas here reuse its event names. */
	mockup: MockupCopy;
};

export function WhyContent({ locale, copy }: { locale: Locale; copy: WhyCopy }) {
	const { pillars, replicas } = copy;
	return (
		<ShowcaseSection id={SECTION_IDS.why} index={1} eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle}>
			<ShowcaseGrid>
				<ShowcaseCell title={pillars.local.title} body={pillars.local.body}>
					<DataSettingsReplica copy={replicas.data} tabs={replicas.settingsTabs} />
				</ShowcaseCell>
				<ShowcaseCell title={pillars.fast.title} body={pillars.fast.body}>
					<EventSearchReplica locale={locale} copy={replicas.search} events={copy.mockup.events} />
				</ShowcaseCell>
				<ShowcaseCell title={pillars.sync.title} body={pillars.sync.body}>
					<GoogleConnectReplica copy={replicas.google.card} />
				</ShowcaseCell>
				<ShowcaseCell title={pillars.lasting.title} body={pillars.lasting.body}>
					<EventRecordReplica title={copy.mockup.events.designReview} />
				</ShowcaseCell>
			</ShowcaseGrid>
		</ShowcaseSection>
	);
}
