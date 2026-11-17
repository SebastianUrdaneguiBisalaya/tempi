'use client';

import { MAX_DICTATION_SECONDS } from '@tempi/core';
import { issueTranslation } from '@tempi/i18n';
import { MicIcon, MicOffIcon, SquareIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useSettingsDialog } from '@/features/settings/components/settings-dialog-provider';
import { WAVEFORM_BARS } from '../dictation-store';
import { useDictation, useDictationMeter } from './assistant-provider';

// Bars are fixed positions in a rolling window of levels, so each position is its own stable key.
const BARS = Array.from({ length: WAVEFORM_BARS }, (_, position) => ({ id: `bar-${position}`, position }));

const clock = (ms: number) => {
	const seconds = Math.floor(ms / 1000);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** Vertical bars that follow the microphone level while recording, and the time recorded out of the maximum. */
export function DictationWaveform() {
	const { t } = useTranslation();
	const { status } = useDictation();
	const { elapsedMs, levels } = useDictationMeter();
	if (status === 'idle') return null;
	if (status === 'transcribing')
		return (
			<p aria-live='polite' className='flex items-center gap-2 px-1 text-muted-foreground'>
				<Spinner />
				{t('assistant.dictation.transcribing')}
			</p>
		);
	return (
		<div className='flex items-center gap-3 px-1'>
			<div aria-hidden className='flex h-8 flex-1 items-center gap-0.5'>
				{BARS.map(({ id, position }) => (
					<span
						className='w-full min-w-0.5 rounded-full bg-primary transition-[height] duration-75 motion-reduce:transition-none'
						key={id}
						style={{ height: `${Math.max(8, (levels[position] ?? 0) * 100)}%` }}
					/>
				))}
			</div>
			<span className='shrink-0 text-muted-foreground tabular-nums'>
				<span className='sr-only'>{t('assistant.dictation.recording')} </span>
				{clock(elapsedMs)} / {clock(MAX_DICTATION_SECONDS * 1000)}
			</span>
		</div>
	);
}

/** Why the microphone couldn't start, translated. */
export function DictationError() {
	const { t } = useTranslation();
	const { error } = useDictation();
	if (error === null) return null;
	const { key, options } = issueTranslation({ key: error });
	return (
		<p className='px-1 text-destructive' role='alert'>
			{/* A `defaultValue` selects i18next's untyped overload, since the key is only known at runtime. */}
			{t(key, { ...options, defaultValue: t('system.unexpected', { ns: 'errors' }) })}
		</p>
	);
}

/**
 * The mic button: click to record, click again to stop and transcribe into the prompt. Without an ElevenLabs key it
 * becomes a hint that opens Settings › Integrations.
 */
export function DictationButton({ available }: { available: boolean }) {
	const { t } = useTranslation();
	const { openSettings } = useSettingsDialog();
	const { start, status, stop } = useDictation();

	if (!available)
		return (
			<Button
				aria-label={t('assistant.dictation.unavailable')}
				onClick={() => openSettings('integrations')}
				size='icon-sm'
				title={t('assistant.dictation.unavailable')}
				type='button'
				variant='ghost'
			>
				<MicOffIcon className='text-muted-foreground' />
			</Button>
		);

	const recording = status === 'recording';
	const label = t(recording ? 'assistant.dictation.stop' : 'assistant.dictation.start');
	return (
		<Button
			aria-label={label}
			aria-pressed={recording}
			disabled={status === 'transcribing'}
			onClick={recording ? stop : start}
			size='icon-sm'
			title={label}
			type='button'
			variant={recording ? 'destructive' : 'ghost'}
		>
			{status === 'transcribing' ? <Spinner /> : recording ? <SquareIcon /> : <MicIcon />}
		</Button>
	);
}
