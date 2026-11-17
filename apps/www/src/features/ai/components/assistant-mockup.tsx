'use client';

import { MinusIcon, SquarePenIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type ChatCopy, ChatMockup, type ChatStep, ProviderPill } from './chat-mockup';
import { VoiceOrbMockup, type VoicePhase } from './voice-orb-mockup';

export type AssistantTab = 'chat' | 'voice';

export type AssistantMockupCopy = {
	/** Describes the animation for assistive tech, which skips the replica itself. */
	label: string;
	tabs: Record<AssistantTab, string>;
	chat: ChatCopy;
	voiceStatus: Record<VoicePhase, string>;
};

type AssistantMockupProps = {
	copy: AssistantMockupCopy;
	/** The provider the demo answers with, as the app's picker names it. */
	provider: string;
	tab: AssistantTab;
	typed: string;
	step: ChatStep;
	phase: VoicePhase;
};

/** Static replica of the app's assistant panel (apps/web `assistant.tsx`): Chat and Voice tabs over one conversation. */
export function AssistantMockup({ copy, provider, tab, typed, step, phase }: AssistantMockupProps) {
	return (
		<div role='img' aria-label={copy.label} className='overflow-hidden rounded-xl bg-popover text-xs/relaxed text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
			{/* Inert: the replica's tabs and buttons look real but can't be focused, clicked or read out. */}
			<div inert className='h-[34rem] select-none'>
				<Tabs value={tab} className='flex h-full min-h-0 flex-col gap-0'>
					<div className='flex items-center gap-1 border-b px-2 py-1.5'>
						<TabsList>
							<TabsTrigger value='chat'>{copy.tabs.chat}</TabsTrigger>
							<TabsTrigger value='voice'>{copy.tabs.voice}</TabsTrigger>
						</TabsList>
						<Button className='ml-auto' size='icon-sm' variant='ghost'>
							<SquarePenIcon />
						</Button>
						<Button size='icon-sm' variant='ghost'>
							<MinusIcon />
						</Button>
					</div>
					<TabsContent value='chat' className='flex min-h-0 flex-1 flex-col'>
						<ChatMockup copy={copy.chat} provider={provider} typed={typed} step={step} />
					</TabsContent>
					<TabsContent value='voice' className='flex min-h-0 flex-1 flex-col'>
						<div className='flex items-center gap-2 border-b px-2 py-1.5'>
							<ProviderPill name={provider} />
						</div>
						<div className='flex flex-1 flex-col items-center justify-center gap-4 p-4'>
							<VoiceOrbMockup phase={phase} />
							<p className='text-center text-muted-foreground'>{copy.voiceStatus[phase]}</p>
						</div>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
