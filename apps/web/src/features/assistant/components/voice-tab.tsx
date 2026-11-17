'use client';

import { TEXT_PROVIDERS } from '@tempi/core';
import { issueTranslation } from '@tempi/i18n';
import { AudioLinesIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useSettingsDialog } from '@/features/settings/components/settings-dialog-provider';
import { useAiSettings } from '@/features/settings/hooks/use-ai';
import type { VoicePhase } from '../voice-store';
import { useAssistant, useVoice } from './assistant-provider';
import { ReplyError } from './chat-tab';
import { ProposalCard } from './proposal-card';
import { ProviderSelect } from './provider-select';
import { VoiceOrb } from './voice-orb';

const ORB_LABELS = {
	idle: 'assistant.voice.orb.talk',
	listening: 'assistant.voice.orb.listening',
	speaking: 'assistant.voice.orb.speaking',
	thinking: 'assistant.voice.orb.thinking',
} as const satisfies Record<VoicePhase, string>;

/** Shown without an ElevenLabs key or a text provider key: voice needs both, and the way to add them is one click away. */
function VoiceSetup() {
	const { t } = useTranslation();
	const { openSettings } = useSettingsDialog();
	return (
		<div className='flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center'>
			<AudioLinesIcon aria-hidden className='size-6 text-muted-foreground' />
			<div className='flex flex-col gap-1'>
				<p className='font-medium'>{t('assistant.voice.empty.title')}</p>
				<p className='text-muted-foreground'>{t('assistant.voice.empty.description')}</p>
			</div>
			<Button onClick={() => openSettings('integrations')} size='sm' variant='outline'>
				{t('assistant.empty.action')}
			</Button>
		</div>
	);
}

/** Why the last exchange stopped short on this side (microphone, playback), translated. */
function VoiceError() {
	const { t } = useTranslation();
	const { error } = useVoice();
	if (error === null) return null;
	const { key, options } = issueTranslation({ key: error });
	return (
		<p className='text-center text-destructive' role='alert'>
			{/* A `defaultValue` selects i18next's untyped overload, since the key is only known at runtime. */}
			{t(key, { ...options, defaultValue: t('system.unexpected', { ns: 'errors' }) })}
		</p>
	);
}

/**
 * Talking to the assistant, with no message list: the orb records, sends, cancels and stops; the reply is read aloud.
 * It continues the Chat tab's conversation, and changes still wait for Confirm on the cards under the orb.
 */
export function VoiceTab({ onEdit }: { onEdit: () => void }) {
	const { t } = useTranslation();
	const { data: settings } = useAiSettings();
	const { phase, tap } = useVoice();
	const { requestId, setProposalStatus, setVoiceProvider, turns, voiceProvider: picked } = useAssistant();
	if (settings === undefined) return null;
	const enabled = TEXT_PROVIDERS.filter(provider => settings.keys[provider]);
	// Only providers with a key are offered; one whose key was removed falls back to the first left.
	const provider = picked !== null && enabled.includes(picked) ? picked : enabled[0];
	if (provider === undefined || !settings.keys.elevenlabs) return <VoiceSetup />;

	const last = turns.at(-1);
	const reply = last?.role === 'assistant' ? last : null;
	const proposals = reply?.proposals.filter(item => item.status !== 'canceled') ?? [];
	// A reply typed in the Chat tab is still streaming: wait for it before talking.
	const busy = phase === 'idle' && requestId !== null;

	return (
		<div className='flex min-h-0 flex-1 flex-col'>
			<div className='flex items-center gap-2 border-b px-2 py-1.5'>
				<ProviderSelect enabled={enabled} onChange={setVoiceProvider} settings={settings} value={provider} />
			</div>
			<div className='flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto p-4'>
				<div className='flex flex-1 flex-col items-center justify-center gap-4 py-4'>
					<VoiceOrb disabled={busy} label={t(ORB_LABELS[phase])} onTap={() => tap(provider)} phase={phase} />
					<p aria-live='polite' className='text-center text-muted-foreground'>
						{t(`assistant.voice.status.${phase}`)}
					</p>
					<VoiceError />
					{reply !== null && phase === 'idle' && <ReplyError turn={reply} />}
				</div>
				{reply !== null && proposals.length > 0 && (
					<section aria-label={t('assistant.voice.proposals')} className='flex w-full flex-col gap-2'>
						{proposals.map(item => (
							<ProposalCard
								item={item}
								key={item.id}
								onCancel={() => setProposalStatus(reply.id, item.id, 'canceled')}
								onConfirmed={() => setProposalStatus(reply.id, item.id, 'confirmed')}
								onEdit={onEdit}
							/>
						))}
					</section>
				)}
			</div>
		</div>
	);
}
