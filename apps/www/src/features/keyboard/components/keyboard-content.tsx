'use client';

import { useRef, useState } from 'react';
import { gsap, useMotion } from '@/lib/gsap';
import { SHOWN_SHORTCUTS, type ShownShortcut } from '@/lib/hotkeys';
import { type CommandMenuCopy, CommandMenuDemo } from './command-menu-demo';
import { Hotkey } from './hotkey';

const SHORTCUT_GROUPS = {
	navigation: ['goToToday', 'next', 'previous', 'goToDate'],
	views: ['dayView', 'weekView', 'monthView'],
	events: ['newEvent', 'undo'],
	general: ['openCommandMenu', 'showShortcuts', 'openSettings', 'togglePanel'],
} as const satisfies Record<string, readonly ShownShortcut[]>;

type GroupKey = keyof typeof SHORTCUT_GROUPS;

export type KeyboardCopy = {
	eyebrow: string;
	title: string;
	subtitle: string;
	/** What the demo types into the command menu. */
	query: string;
	commandMenu: CommandMenuCopy;
	groups: Record<GroupKey, string>;
	actions: Record<ShownShortcut, string>;
};

const TYPE_DELAY = 0.14;

export function KeyboardContent({ copy }: { copy: KeyboardCopy }) {
	const ref = useRef<HTMLElement>(null);
	// The final frame of the demo: what visitors without motion (and the prerender) see.
	const [typed, setTyped] = useState(copy.query);
	const [pressed, setPressed] = useState(false);

	useMotion(ref, () => {
		gsap.from('[data-keyboard-intro]', { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 70%' } });
		gsap.from('[data-shortcut-row]', { x: 16, autoAlpha: 0, duration: 0.5, stagger: 0.04, ease: 'power2.out', scrollTrigger: { trigger: '[data-shortcut-row]', start: 'top 85%' } });

		const demo = gsap.timeline({
			repeat: -1,
			repeatDelay: 0.8,
			// Plays only while the demo is on screen.
			scrollTrigger: { trigger: '[data-command-demo]', start: 'top 85%', end: 'bottom 15%', toggleActions: 'play pause resume pause' },
		});
		demo.call(() => {
			setTyped('');
			setPressed(false);
		})
			.fromTo('[data-command-demo]', { autoAlpha: 0, y: 12, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: 'power3.out' })
			.to({}, { duration: 0.6 });
		for (let index = 1; index <= copy.query.length; index++) {
			demo.call(() => setTyped(copy.query.slice(0, index)), [], `+=${TYPE_DELAY}`);
		}
		demo.to({}, { duration: 1.1 })
			.call(() => setPressed(true))
			.to({}, { duration: 0.35 })
			.call(() => setPressed(false))
			.to('[data-command-demo]', { autoAlpha: 0, y: -8, scale: 0.98, duration: 0.35, ease: 'power2.in' }, '+=0.4');
	});

	return (
		<section ref={ref} className='mx-auto w-full max-w-6xl px-4 sm:px-6'>
			<div className='border-t py-24 md:py-32'>
				<div className='grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-12'>
					<div>
						<p data-keyboard-intro className='text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase'>
							{copy.eyebrow}
						</p>
						<h2 data-keyboard-intro className='mt-4 font-heading text-4xl leading-[1.1] font-medium tracking-tight text-balance sm:text-5xl'>
							{copy.title}
						</h2>
					</div>
					<p data-keyboard-intro className='max-w-md text-base leading-relaxed text-foreground/70 lg:justify-self-end'>
						{copy.subtitle}
					</p>
				</div>

				<div className='mt-14 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16'>
					{/* A faint stage behind the menu, standing in for the app window it opens over. */}
					<div className='flex items-center justify-center rounded-2xl border bg-muted/15 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px] p-4 sm:p-10'>
						<div data-command-demo className='w-full max-w-md'>
							<CommandMenuDemo copy={copy.commandMenu} actionLabels={copy.actions} typed={typed} pressed={pressed} />
						</div>
					</div>

					<div className='grid gap-8 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2'>
						{(Object.entries(SHORTCUT_GROUPS) as [GroupKey, readonly ShownShortcut[]][]).map(([group, actions]) => (
							<div key={group}>
								<h3 className='text-xs font-medium text-muted-foreground'>{copy.groups[group]}</h3>
								<ul className='mt-2'>
									{actions.map(action => (
										<li key={action} data-shortcut-row className='flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm'>
											<span className='text-foreground/85'>{copy.actions[action]}</span>
											<Hotkey keys={SHOWN_SHORTCUTS[action]} />
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
