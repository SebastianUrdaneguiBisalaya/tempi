'use client';

import { AudioLinesIcon, CircleCheckIcon, KeyRoundIcon, LockIcon, type LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Hotkey } from '@/features/keyboard/components/hotkey';
import { gsap, useMotion } from '@/lib/gsap';
import { SHOWN_SHORTCUTS } from '@/lib/hotkeys';
import { SECTION_IDS } from '@/lib/site';
import { AssistantMockup, type AssistantMockupCopy, type AssistantTab } from './assistant-mockup';
import type { ChatStep } from './chat-mockup';
import { ProviderLogos } from './provider-logos';
import type { VoicePhase } from './voice-orb-mockup';

const POINTS = [
	{ key: 'keys', icon: KeyRoundIcon },
	{ key: 'voice', icon: AudioLinesIcon },
	{ key: 'confirm', icon: CircleCheckIcon },
	{ key: 'private', icon: LockIcon },
] as const satisfies readonly { key: string; icon: LucideIcon }[];

type Point = { title: string; body: string };

export type AiCopy = {
	eyebrow: string;
	title: string;
	subtitle: string;
	mockup: AssistantMockupCopy;
	points: Record<(typeof POINTS)[number]['key'], Point>;
	providers: string;
	shortcut: string;
};

// The provider the demo answers with.
const DEMO_PROVIDER = 'Anthropic';

const TYPE_DELAY = 0.05;

export function AiContent({ copy }: { copy: AiCopy }) {
	const ref = useRef<HTMLElement>(null);
	// The final frame of the chat: what visitors without motion (and the prerender) see.
	const [tab, setTab] = useState<AssistantTab>('chat');
	const [typed, setTyped] = useState('');
	const [step, setStep] = useState<ChatStep>('saved');
	const [phase, setPhase] = useState<VoicePhase>('idle');

	useMotion(ref, () => {
		gsap.from('[data-ai-intro]', { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 70%' } });
		gsap.from('[data-ai-point]', { x: 16, autoAlpha: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out', scrollTrigger: { trigger: '[data-ai-point]', start: 'top 85%' } });

		const message = copy.mockup.chat.message;
		const demo = gsap.timeline({
			repeat: -1,
			repeatDelay: 0.8,
			// Plays only while the demo is on screen.
			scrollTrigger: { trigger: '[data-ai-demo]', start: 'top 85%', end: 'bottom 15%', toggleActions: 'play pause resume pause' },
		});
		demo.call(() => {
			setTab('chat');
			setTyped('');
			setStep('empty');
			setPhase('idle');
		})
			.fromTo('[data-ai-demo]', { autoAlpha: 0, y: 12, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: 'power3.out' })
			.to({}, { duration: 0.6 });
		for (let index = 1; index <= message.length; index++) {
			demo.call(() => setTyped(message.slice(0, index)), [], `+=${TYPE_DELAY}`);
		}
		demo.call(
			() => {
				setTyped('');
				setStep('sent');
			},
			[],
			'+=0.5'
		)
			.call(() => setStep('looking'), [], '+=0.6')
			.call(() => setStep('proposed'), [], '+=1.4')
			.call(() => setStep('confirming'), [], '+=2')
			.call(() => setStep('saved'), [], '+=0.7')
			.call(() => setTab('voice'), [], '+=1.8')
			.call(() => setPhase('listening'), [], '+=1')
			.call(() => setPhase('thinking'), [], '+=2.2')
			.call(() => setPhase('speaking'), [], '+=1.6')
			.call(() => setPhase('idle'), [], '+=2.6')
			.to('[data-ai-demo]', { autoAlpha: 0, y: -8, scale: 0.98, duration: 0.35, ease: 'power2.in' }, '+=1');
	});

	return (
		<section ref={ref} id={SECTION_IDS.ai} className='mx-auto w-full max-w-6xl px-4 sm:px-6'>
			<div className='border-t py-24 md:py-32'>
				<div className='grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-12'>
					<div>
						<p data-ai-intro className='text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase'>
							{copy.eyebrow}
						</p>
						<h2 data-ai-intro className='mt-4 font-heading text-4xl leading-[1.1] font-medium tracking-tight text-balance sm:text-5xl'>
							{copy.title}
						</h2>
					</div>
					<p data-ai-intro className='max-w-md text-base leading-relaxed text-foreground/70 lg:justify-self-end'>
						{copy.subtitle}
					</p>
				</div>

				<div className='mt-14 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16'>
					{/* A faint stage behind the panel, standing in for the app window it floats over. */}
					<div className='flex items-center justify-center rounded-2xl border bg-muted/15 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px] p-4 sm:p-10'>
						<div data-ai-demo className='w-full max-w-sm'>
							<AssistantMockup copy={copy.mockup} provider={DEMO_PROVIDER} tab={tab} typed={typed} step={step} phase={phase} />
						</div>
					</div>

					<div className='flex flex-col gap-8'>
						<ul className='flex flex-col gap-6'>
							{POINTS.map(({ key, icon: Icon }) => (
								<li key={key} data-ai-point className='flex gap-4'>
									<Icon aria-hidden className='mt-0.5 size-5 shrink-0 text-muted-foreground' />
									<div className='flex flex-col gap-1'>
										<h3 className='text-sm font-medium'>{copy.points[key].title}</h3>
										<p className='text-sm leading-relaxed text-foreground/70'>{copy.points[key].body}</p>
										{key === 'keys' && (
											<div className='mt-2'>
												<ProviderLogos label={copy.providers} />
											</div>
										)}
									</div>
								</li>
							))}
						</ul>
						<p data-ai-point className='flex flex-wrap items-center gap-2 border-t pt-6 text-sm text-foreground/70'>
							{copy.shortcut}
							<Hotkey keys={SHOWN_SHORTCUTS.toggleAssistant} />
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
