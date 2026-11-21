'use client';

import type { TextProvider } from '@tempi/core';
import { TEXT_PROVIDERS } from '@tempi/core';
import { issueTranslation } from '@tempi/i18n';
import { AudioLinesIcon, MicOffIcon } from 'lucide-react';
import { useEffect, useEffectEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useSettingsDialog } from '@/features/settings/components/settings-dialog-provider';
import { useAiSettings } from '@/features/settings/hooks/use-ai';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { useShortcut } from '@/features/shortcuts/hooks/use-shortcut';
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

/** Shown under a disabled orb while the microphone is off in Tempi, with the way to turn it on. */
function MicrophoneOff() {
	const { t } = useTranslation();
	const { openSettings } = useSettingsDialog();
	return (
		<div className='flex flex-col items-center gap-3 text-center'>
			<div className='flex flex-col items-center gap-1'>
				<p className='flex items-center gap-1.5 font-medium'>
					<MicOffIcon aria-hidden className='size-4 text-muted-foreground' />
					{t('assistant.voice.microphoneOff.title')}
				</p>
				<p className='text-muted-foreground'>{t('assistant.voice.microphoneOff.description')}</p>
			</div>
			<Button onClick={() => openSettings('permissions')} size='sm' variant='outline'>
				{t('assistant.voice.microphoneOff.action')}
			</Button>
		</div>
	);
}

/** Why the last exchange stopped short on this side (microphone, playback), translated. */
function VoiceError() {
	const { t } = useTranslation();
	const error = useVoice(state => state.error);
	if (error === null) return null;
	const { key, options } = issueTranslation({ key: error });
	return (
		<p className='text-center text-destructive' role='alert'>
			{/* A `defaultValue` selects i18next's untyped overload, since the key is only known at runtime. */}
			{t(key, { ...options, defaultValue: t('system.unexpected', { ns: 'errors' }) })}
		</p>
	);
}

/** The last turn, if it is a reply. Only what reads it re-renders while it streams. */
const useLastReply = () => {
	const last = useAssistant(state => state.turns.at(-1));
	return last?.role === 'assistant' ? last : null;
};

/** Why the last reply ended early, once the exchange is over. */
function LastReplyError({ phase }: { phase: VoicePhase }) {
	const reply = useLastReply();
	return reply !== null && phase === 'idle' ? <ReplyError turn={reply} /> : null;
}

/** The changes the last reply proposed, waiting for Confirm. */
function LastReplyProposals({ onEdit }: { onEdit: () => void }) {
	const { t } = useTranslation();
	const reply = useLastReply();
	const setProposalStatus = useAssistant(state => state.setProposalStatus);
	const proposals = reply?.proposals.filter(item => item.status !== 'canceled') ?? [];
	if (reply === null || proposals.length === 0) return null;
	return (
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
	);
}

/**
 * Space while focus is in the Voice tab: a quick press taps the orb, a long one talks until Space is released. Off
 * while the orb is disabled; typing in a field never triggers it.
 */
function useHoldToTalk(provider: TextProvider, disabled: boolean) {
	const ref = useRef<HTMLDivElement>(null);
	// Whether Space went down here, so only that press's release is taken (and other buttons keep Space).
	const pressing = useRef(false);
	const press = useVoice(state => state.press);
	const release = useVoice(state => state.release);
	const end = () => {
		if (!pressing.current) return;
		pressing.current = false;
		release();
	};
	useShortcut(
		'holdToTalk',
		() => {
			pressing.current = true;
			press(provider);
		},
		{ element: ref, enabled: () => !disabled }
	);
	// The release is caught anywhere, so moving focus mid-press still sends.
	useShortcut('holdToTalk', end, { enabled: () => pressing.current, on: 'keyup' });
	// Leaving the tab or the window mid-press can swallow the keyup: end the press there too.
	const onBlur = useEffectEvent(end);
	useEffect(() => {
		const listener = () => onBlur();
		window.addEventListener('blur', listener);
		return () => {
			window.removeEventListener('blur', listener);
			listener();
		};
	}, []);
	return ref;
}

/** The Voice tab once set up: provider picker, orb (and Space) and what the last reply proposed. */
function VoiceTalk({ enabled, onEdit, provider }: { enabled: TextProvider[]; onEdit: () => void; provider: TextProvider }) {
	const { t } = useTranslation();
	const { data: settings } = useAiSettings();
	const microphoneEnabled = useSettings().data?.microphoneEnabled !== false;
	const phase = useVoice(state => state.phase);
	const tap = useVoice(state => state.tap);
	const setVoiceProvider = useAssistant(state => state.setVoiceProvider);
	// A reply typed in the Chat tab is still streaming: wait for it before talking.
	const streaming = useAssistant(state => state.requestId !== null);
	const disabled = phase === 'idle' && (streaming || !microphoneEnabled);
	const ref = useHoldToTalk(provider, disabled);
	if (settings === undefined) return null;

	return (
		<div className='flex min-h-0 flex-1 flex-col' ref={ref}>
			<div className='flex items-center gap-2 border-b px-2 py-1.5'>
				<ProviderSelect enabled={enabled} onChange={setVoiceProvider} settings={settings} value={provider} />
			</div>
			<div className='flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto p-4'>
				<div className='flex flex-1 flex-col items-center justify-center gap-4 py-4'>
					<VoiceOrb disabled={disabled} label={t(ORB_LABELS[phase])} onTap={() => tap(provider)} phase={phase} />
					{microphoneEnabled ? (
						<p aria-live='polite' className='text-center text-muted-foreground'>
							{t(`assistant.voice.status.${phase}`)}
						</p>
					) : (
						<MicrophoneOff />
					)}
					<VoiceError />
					<LastReplyError phase={phase} />
				</div>
				<LastReplyProposals onEdit={onEdit} />
			</div>
		</div>
	);
}

/**
 * Talking to the assistant, with no message list: the orb records, sends, cancels and stops; the reply is read aloud.
 * It continues the Chat tab's conversation, and changes still wait for Confirm on the cards under the orb.
 */
export function VoiceTab({ onEdit }: { onEdit: () => void }) {
	const { data: settings } = useAiSettings();
	const picked = useAssistant(state => state.voiceProvider);
	if (settings === undefined) return null;
	const enabled = TEXT_PROVIDERS.filter(provider => settings.keys[provider]);
	// Only providers with a key are offered; one whose key was removed falls back to the first left.
	const provider = picked !== null && enabled.includes(picked) ? picked : enabled[0];
	if (provider === undefined || !settings.keys.elevenlabs) return <VoiceSetup />;
	return <VoiceTalk enabled={enabled} onEdit={onEdit} provider={provider} />;
}
