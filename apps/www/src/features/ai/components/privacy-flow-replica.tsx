'use client';

import { CloudOffIcon, LaptopIcon, LockIcon, SparklesIcon, XIcon } from 'lucide-react';
import { useRef } from 'react';
import { onEnter } from '@/components/showcase';
import { gsap, useMotion } from '@/lib/gsap';

export type PrivacyFlowCopy = {
	device: string;
	keyEncrypted: string;
	provider: string;
	/** What travels to the provider, and only while the assistant is used. */
	sent: string;
	tempi: string;
	never: string;
};

const NODE = 'flex flex-col items-center gap-2 rounded-xl bg-popover p-4 text-center text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10';

/** Where assistant data goes: from the visitor's computer to their provider, never through a Tempi server. */
export function PrivacyFlowReplica({ copy }: { copy: PrivacyFlowCopy }) {
	const ref = useRef<HTMLDivElement>(null);

	useMotion(ref, () => {
		gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.5, repeat: 2, repeatDelay: 0.4 }).fromTo(
			'[data-flow-packet]',
			{ left: '0%', autoAlpha: 0 },
			{
				keyframes: [
					{ autoAlpha: 1, duration: 0.15 },
					{ left: '100%', duration: 1.1, ease: 'power1.inOut' },
					{ autoAlpha: 0, duration: 0.15 },
				],
			}
		);
	});

	return (
		<div ref={ref} className='flex w-full max-w-md flex-col items-center gap-6 text-xs/relaxed'>
			<div className='flex w-full items-center'>
				<div className={NODE}>
					<LaptopIcon className='size-6' />
					<span className='font-medium'>{copy.device}</span>
					<span className='flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground'>
						<LockIcon className='size-3' />
						{copy.keyEncrypted}
					</span>
				</div>
				<div className='relative mx-2 flex h-px flex-1 items-center bg-border'>
					<span data-flow-packet className='absolute size-2 -translate-x-1/2 rounded-full bg-emerald-500 opacity-0 shadow-[0_0_8px_var(--color-emerald-500)]' />
					<span className='absolute inset-x-0 -top-6 truncate text-center text-[0.65rem] text-muted-foreground'>{copy.sent}</span>
				</div>
				<div className={NODE}>
					<SparklesIcon className='size-6' />
					<span className='font-medium'>{copy.provider}</span>
				</div>
			</div>
			<div className='flex flex-col items-center gap-2'>
				<span className='flex size-6 items-center justify-center rounded-full border border-dashed text-muted-foreground'>
					<XIcon className='size-3' />
				</span>
				<div className='flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-muted-foreground'>
					<CloudOffIcon className='size-4' />
					<span className='font-medium'>{copy.tempi}</span>
					<span className='text-muted-foreground/70'>· {copy.never}</span>
				</div>
			</div>
		</div>
	);
}
