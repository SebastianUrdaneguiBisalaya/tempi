'use client';

import { useRef, useState } from 'react';
import { onEnter } from '@/components/showcase';
import { gsap, useMotion } from '@/lib/gsap';
import { ElevenLabsMark } from './provider-marquee';
import { VoiceOrbMockup, type VoicePhase } from './voice-orb-mockup';

/** The assistant's Voice tab (apps/web `voice-tab.tsx`), whose speech runs on ElevenLabs; on enter it listens, thinks and answers once. */
export function VoiceReplica({ status }: { status: Record<VoicePhase, string> }) {
	const ref = useRef<HTMLDivElement>(null);
	const [phase, setPhase] = useState<VoicePhase>('idle');

	useMotion(ref, () => {
		gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.6 })
			.call(() => setPhase('listening'))
			.call(() => setPhase('thinking'), [], '+=2.2')
			.call(() => setPhase('speaking'), [], '+=1.6')
			.call(() => setPhase('idle'), [], '+=2.6');
		return () => setPhase('idle');
	});

	return (
		<div ref={ref} className='flex w-full max-w-xs flex-col overflow-hidden rounded-xl bg-popover text-xs/relaxed text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
			<div className='flex items-center gap-2 border-b px-2 py-1.5'>
				{/* Brand name, the same in every language. */}
				<span className='flex h-6 items-center gap-1.5 rounded-md border bg-input/30 px-2'>
					<ElevenLabsMark className='size-3.5' />
					ElevenLabs
				</span>
			</div>
			<div className='flex flex-col items-center justify-center gap-4 p-6'>
				<VoiceOrbMockup phase={phase} />
				<p className='text-center text-muted-foreground'>{status[phase]}</p>
			</div>
		</div>
	);
}
