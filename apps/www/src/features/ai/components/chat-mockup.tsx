import { ArrowUpIcon, ChevronDownIcon, MicIcon, WrenchIcon } from 'lucide-react';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker';
import { Message, MessageContent, MessageHeader } from '@/components/ui/message';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ProposalCardMockup, type ProposalCopy } from './proposal-card-mockup';

/** Where the demo conversation is, in order. */
export const CHAT_STEPS = ['empty', 'sent', 'looking', 'proposed', 'confirming', 'saved'] as const;

export type ChatStep = (typeof CHAT_STEPS)[number];

export type ChatCopy = {
	welcome: string;
	placeholder: string;
	/** What the demo types and sends. */
	message: string;
	tool: string;
	reply: string;
	proposal: ProposalCopy;
};

const reached = (step: ChatStep, target: ChatStep) => CHAT_STEPS.indexOf(step) >= CHAT_STEPS.indexOf(target);

/** The provider picker under the prompt, as the app shows it. */
export function ProviderPill({ name }: { name: string }) {
	return (
		<span className='flex h-6 items-center gap-1 rounded-md border bg-input/30 px-2 text-xs/relaxed'>
			{name}
			<ChevronDownIcon className='size-3 text-muted-foreground' />
		</span>
	);
}

type ChatMockupProps = {
	copy: ChatCopy;
	provider: string;
	/** What the prompt holds while the demo types. */
	typed: string;
	step: ChatStep;
};

/** Static replica of the app's Chat tab (apps/web `chat-tab.tsx`); the section's timeline drives `typed` and `step`. */
export function ChatMockup({ copy, provider, typed, step }: ChatMockupProps) {
	return (
		<div className='flex min-h-0 flex-1 flex-col'>
			<div className='flex min-h-0 flex-1 flex-col justify-end gap-4 overflow-hidden p-3'>
				{step === 'empty' ? (
					<Marker className='mb-auto'>
						<MarkerContent>{copy.welcome}</MarkerContent>
					</Marker>
				) : (
					<Message align='end'>
						<MessageContent>
							<Bubble>
								<BubbleContent>{copy.message}</BubbleContent>
							</Bubble>
						</MessageContent>
					</Message>
				)}
				{reached(step, 'looking') && (
					<Message>
						<MessageContent>
							<MessageHeader>{provider}</MessageHeader>
							<Marker>
								<MarkerIcon>{step === 'looking' ? <Spinner /> : <WrenchIcon />}</MarkerIcon>
								<MarkerContent>{copy.tool}</MarkerContent>
							</Marker>
							{reached(step, 'proposed') && (
								<>
									<Bubble variant='muted'>
										<BubbleContent>{copy.reply}</BubbleContent>
									</Bubble>
									<ProposalCardMockup copy={copy.proposal} status={step === 'saved' ? 'saved' : step === 'confirming' ? 'confirming' : 'pending'} />
								</>
							)}
						</MessageContent>
					</Message>
				)}
			</div>
			<div className='flex flex-col gap-2 border-t p-2'>
				<Textarea readOnly tabIndex={-1} className='min-h-12 resize-none' placeholder={copy.placeholder} value={typed} />
				<div className='flex items-center gap-2'>
					<ProviderPill name={provider} />
					<span className='ml-auto' />
					<Button size='icon-sm' variant='ghost'>
						<MicIcon />
					</Button>
					<Button size='icon-sm' disabled={typed === ''}>
						<ArrowUpIcon />
					</Button>
				</div>
			</div>
		</div>
	);
}
