'use client';

import { ShowcaseCell, ShowcaseGrid, ShowcaseSection } from '@/components/showcase';
import { Hotkey } from '@/features/keyboard/components/hotkey';
import { SHOWN_SHORTCUTS } from '@/lib/hotkeys';
import { SECTION_IDS } from '@/lib/site';
import type { ChatCopy } from './chat-mockup';
import { ChatReplica } from './chat-replica';
import { type PrivacyFlowCopy, PrivacyFlowReplica } from './privacy-flow-replica';
import { type ProviderKeysCopy, ProviderKeysReplica } from './provider-keys-replica';
import { ProviderMarquee } from './provider-marquee';
import type { VoicePhase } from './voice-orb-mockup';
import { VoiceReplica } from './voice-replica';

type Point = { title: string; body: string };

export type AiCopy = {
	eyebrow: string;
	title: string;
	subtitle: string;
	mockup: { chat: ChatCopy; voiceStatus: Record<VoicePhase, string> };
	replicas: { keys: ProviderKeysCopy; privacy: PrivacyFlowCopy };
	points: Record<'keys' | 'voice' | 'confirm' | 'private', Point>;
	providers: string;
	shortcut: string;
};

// The provider the chat replica answers with.
const DEMO_PROVIDER = 'Anthropic';

export function AiContent({ copy }: { copy: AiCopy }) {
	const { points, replicas } = copy;
	return (
		<ShowcaseSection id={SECTION_IDS.ai} index={3} eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle}>
			<ShowcaseGrid>
				<ShowcaseCell title={points.keys.title} body={points.keys.body}>
					<ProviderKeysReplica copy={replicas.keys} />
				</ShowcaseCell>
				<ShowcaseCell title={points.voice.title} body={points.voice.body}>
					<VoiceReplica status={copy.mockup.voiceStatus} />
				</ShowcaseCell>
				<ShowcaseCell title={points.confirm.title} body={points.confirm.body}>
					<ChatReplica copy={copy.mockup.chat} provider={DEMO_PROVIDER} />
				</ShowcaseCell>
				<ShowcaseCell title={points.private.title} body={points.private.body}>
					<PrivacyFlowReplica copy={replicas.privacy} />
				</ShowcaseCell>
			</ShowcaseGrid>
			<div className='border-b pb-16 md:px-8'>
				<ProviderMarquee label={copy.providers} />
				<p className='mt-12 flex flex-wrap items-center justify-center gap-2 text-sm text-foreground/70'>
					{copy.shortcut}
					<Hotkey keys={SHOWN_SHORTCUTS.toggleAssistant} />
				</p>
			</div>
		</ShowcaseSection>
	);
}
