'use client';

import { useRef, useState } from 'react';
import { onEnter } from '@/components/showcase';
import { gsap, useMotion } from '@/lib/gsap';
import { type ChatCopy, ChatMockup, type ChatStep } from './chat-mockup';

type ChatReplicaProps = {
	copy: ChatCopy;
	provider: string;
};

/** The assistant's Chat tab; on enter the request is sent, an event proposed and confirmed. */
export function ChatReplica({ copy, provider }: ChatReplicaProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [step, setStep] = useState<ChatStep>('saved');

	useMotion(ref, () => {
		setStep('sent');
		gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.4 })
			.call(() => setStep('looking'), [], '+=0.6')
			.call(() => setStep('proposed'), [], '+=1.4')
			.call(() => setStep('confirming'), [], '+=2')
			.call(() => setStep('saved'), [], '+=0.7');
		return () => setStep('saved');
	});

	return (
		<div
			ref={ref}
			className='flex h-[22rem] w-full max-w-sm flex-col overflow-hidden rounded-xl bg-popover text-xs/relaxed text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'
		>
			<ChatMockup copy={copy} provider={provider} typed='' step={step} />
		</div>
	);
}
