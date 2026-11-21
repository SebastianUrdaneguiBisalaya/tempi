'use client';

import { type AiSettings, assistantMessageSchema, MAX_ASSISTANT_MESSAGE_LENGTH, TEXT_PROVIDERS, type TextProvider } from '@tempi/core';
import { issueTranslation } from '@tempi/i18n';
import { ArrowUpIcon, CircleAlertIcon, CircleStopIcon, KeyRoundIcon, SquareIcon, WrenchIcon } from 'lucide-react';
import { type KeyboardEvent, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Streamdown } from 'streamdown';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker';
import { Message, MessageContent, MessageHeader } from '@/components/ui/message';
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport } from '@/components/ui/message-scroller';
import { Textarea } from '@/components/ui/textarea';
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceIcon, TraceLine, TraceTitle } from '@/components/ui/trace';
import { useSettingsDialog } from '@/features/settings/components/settings-dialog-provider';
import { useAiSettings } from '@/features/settings/hooks/use-ai';
import type { AssistantTurn, ToolTrace } from '../assistant-store';
import { ASSISTANT_FOCUS, useAssistant, useAssistantRequests } from './assistant-provider';
import { DictationButton, DictationError, DictationWaveform } from './dictation-controls';
import { ProposalCard } from './proposal-card';
import { ProviderSelect } from './provider-select';

function TraceRow({ trace }: { trace: ToolTrace }) {
	const { t } = useTranslation();
	return (
		<TraceLine status={trace.status === 'done' ? undefined : trace.status}>
			<TraceIcon>{trace.status === 'error' ? <CircleAlertIcon /> : <WrenchIcon />}</TraceIcon>
			<TraceTitle>{t(`assistant.tools.${trace.tool}`)}</TraceTitle>
		</TraceLine>
	);
}

/** Tool calls: each one live while the reply streams, folded into one line once it ended. */
function Traces({ turn }: { turn: AssistantTurn }) {
	const { t } = useTranslation();
	if (turn.traces.length === 0) return null;
	if (turn.status === 'streaming')
		return (
			<Trace aria-live='polite'>
				{turn.traces.map(trace => (
					<TraceRow key={trace.id} trace={trace} />
				))}
			</Trace>
		);
	const failed = turn.traces.some(trace => trace.status === 'error');
	return (
		<Trace>
			<TraceCollapsible>
				<TraceCollapsibleTrigger>
					<TraceLine status={failed ? 'error' : undefined}>
						<TraceTitle>{t('assistant.toolsUsed', { count: turn.traces.length })}</TraceTitle>
					</TraceLine>
				</TraceCollapsibleTrigger>
				<TraceCollapsibleContent>
					<Trace>
						{turn.traces.map(trace => (
							<TraceRow key={trace.id} trace={trace} />
						))}
					</Trace>
				</TraceCollapsibleContent>
			</TraceCollapsible>
		</Trace>
	);
}

/** Why a reply ended early: stopped by the user, or its translated errors. */
export function ReplyError({ turn }: { turn: AssistantTurn }) {
	const { t } = useTranslation();
	if (turn.status === 'stopped')
		return (
			<Marker>
				<MarkerIcon>
					<SquareIcon />
				</MarkerIcon>
				<MarkerContent>{t('assistant.stopped')}</MarkerContent>
			</Marker>
		);
	if (turn.error === null) return null;
	return (
		<>
			{turn.error.issues.map(issue => {
				const { key, options } = issueTranslation(issue);
				return (
					<Marker className='text-destructive' key={`${issue.key}:${issue.detail}`} role='alert'>
						<MarkerIcon>
							<CircleAlertIcon />
						</MarkerIcon>
						{/* A `defaultValue` selects i18next's untyped overload, since the key is only known at runtime. */}
						<MarkerContent>{t(key, { ...options, defaultValue: t('system.unexpected', { ns: 'errors' }) })}</MarkerContent>
					</Marker>
				);
			})}
		</>
	);
}

function AssistantReply({ onEdit, turn }: { onEdit: () => void; turn: AssistantTurn }) {
	const { t } = useTranslation();
	const setProposalStatus = useAssistant(state => state.setProposalStatus);
	const thinking = turn.status === 'streaming' && turn.text === '' && turn.traces.every(trace => trace.status !== 'running');
	return (
		<Message>
			<MessageContent>
				<MessageHeader>{t(`settings.integrations.ai.providers.${turn.provider}.title`)}</MessageHeader>
				<Traces turn={turn} />
				{turn.text !== '' && (
					<Bubble variant='muted'>
						<BubbleContent>
							{/* Models answer in Markdown whatever the prompt says. Streamdown sanitizes it (no raw HTML) and closes
							    half-written syntax while streaming; links open in the system browser through the main process. */}
							<Streamdown controls={false} isAnimating={turn.status === 'streaming'} linkSafety={{ enabled: false }} mode={turn.status === 'streaming' ? 'streaming' : 'static'}>
								{turn.text}
							</Streamdown>
						</BubbleContent>
					</Bubble>
				)}
				{thinking && (
					<TraceLine status='running'>
						<TraceTitle>{t('assistant.thinking')}</TraceTitle>
					</TraceLine>
				)}
				{turn.proposals.map(item => (
					<ProposalCard item={item} key={item.id} onConfirmed={() => setProposalStatus(turn.id, item.id, 'confirmed')} onEdit={onEdit} />
				))}
				<ReplyError turn={turn} />
			</MessageContent>
		</Message>
	);
}

/** Shown when no text provider has a key: nothing can be sent, and the way to fix it is one click away. */
function NoProvider() {
	const { t } = useTranslation();
	const { openSettings } = useSettingsDialog();
	return (
		<div className='flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center'>
			<KeyRoundIcon aria-hidden className='size-6 text-muted-foreground' />
			<div className='flex flex-col gap-1'>
				<p className='font-medium'>{t('assistant.empty.title')}</p>
				<p className='text-muted-foreground'>{t('assistant.empty.description')}</p>
			</div>
			<Button onClick={() => openSettings('integrations')} size='sm' variant='outline'>
				{t('assistant.empty.action')}
			</Button>
		</div>
	);
}

function PromptInput({ enabled, provider, settings }: { enabled: TextProvider[]; provider: TextProvider; settings: AiSettings }) {
	const { t } = useTranslation();
	const id = useId();
	const draft = useAssistant(state => state.draft);
	const streaming = useAssistant(state => state.requestId !== null);
	const setDraft = useAssistant(state => state.setDraft);
	const setProvider = useAssistant(state => state.setProvider);
	const { send, stop } = useAssistantRequests();
	const canSend = !streaming && assistantMessageSchema.shape.text.safeParse(draft).success;

	const submit = () => {
		if (canSend) send(provider, draft);
	};
	const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		// Enter sends, Shift+Enter starts a new line; never while an IME is composing.
		if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
		event.preventDefault();
		submit();
	};

	return (
		<form
			className='flex flex-col gap-2 border-t p-2'
			onSubmit={event => {
				event.preventDefault();
				submit();
			}}
		>
			<label className='sr-only' htmlFor={`${id}-prompt`}>
				{t('assistant.prompt.label')}
			</label>
			<Textarea
				{...ASSISTANT_FOCUS}
				className='max-h-40 min-h-12'
				id={`${id}-prompt`}
				maxLength={MAX_ASSISTANT_MESSAGE_LENGTH}
				onChange={event => setDraft(event.target.value)}
				onKeyDown={onKeyDown}
				placeholder={t('assistant.prompt.placeholder')}
				value={draft}
			/>
			<DictationWaveform />
			<DictationError />
			<div className='flex items-center gap-2'>
				<ProviderSelect enabled={enabled} onChange={setProvider} settings={settings} value={provider} />
				<span className='ml-auto' />
				<DictationButton available={settings.keys.elevenlabs} />
				{streaming ? (
					<Button aria-label={t('assistant.prompt.stop')} onClick={stop} size='icon-sm' type='button' variant='outline'>
						<CircleStopIcon />
					</Button>
				) : (
					<Button aria-label={t('assistant.prompt.send')} disabled={!canSend} size='icon-sm' type='submit'>
						<ArrowUpIcon />
					</Button>
				)}
			</div>
		</form>
	);
}

/** The messages, streaming replies with their tool calls and proposals. The only part that re-renders per token. */
function Conversation({ onEdit }: { onEdit: () => void }) {
	const { t } = useTranslation();
	const turns = useAssistant(state => state.turns);
	return (
		<MessageScrollerProvider>
			<MessageScroller className='flex-1'>
				<MessageScrollerViewport aria-label={t('assistant.tabs.chat')}>
					<MessageScrollerContent className='gap-4 p-3'>
						{turns.length === 0 && (
							<Marker>
								<MarkerContent>{t('assistant.welcome')}</MarkerContent>
							</Marker>
						)}
						{turns.map(turn => (
							<MessageScrollerItem key={turn.id} messageId={turn.id} scrollAnchor={turn.role === 'user'}>
								{turn.role === 'user' ? (
									<Message align='end'>
										<MessageContent>
											<Bubble>
												<BubbleContent className='whitespace-pre-wrap'>{turn.text}</BubbleContent>
											</Bubble>
										</MessageContent>
									</Message>
								) : (
									<AssistantReply onEdit={onEdit} turn={turn} />
								)}
							</MessageScrollerItem>
						))}
					</MessageScrollerContent>
				</MessageScrollerViewport>
				<MessageScrollerButton aria-label={t('assistant.scrollToEnd')} />
			</MessageScroller>
		</MessageScrollerProvider>
	);
}

/** The conversation and the prompt. */
export function ChatTab({ onEdit }: { onEdit: () => void }) {
	const { data: settings } = useAiSettings();
	const picked = useAssistant(state => state.provider);
	if (settings === undefined) return null;
	const enabled = TEXT_PROVIDERS.filter(provider => settings.keys[provider]);
	// Only providers with a key are offered; one whose key was removed falls back to the first left.
	const provider = picked !== null && enabled.includes(picked) ? picked : enabled[0];
	if (provider === undefined) return <NoProvider />;

	return (
		<div className='flex min-h-0 flex-1 flex-col'>
			<Conversation onEdit={onEdit} />
			<PromptInput enabled={enabled} provider={provider} settings={settings} />
		</div>
	);
}
