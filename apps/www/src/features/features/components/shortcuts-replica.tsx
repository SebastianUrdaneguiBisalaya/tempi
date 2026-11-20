'use client';

import { useRef } from 'react';
import { onEnter } from '@/components/showcase';
import { Hotkey } from '@/features/keyboard/components/hotkey';
import { gsap, useMotion } from '@/lib/gsap';
import { SHOWN_SHORTCUTS, type ShownShortcut } from '@/lib/hotkeys';

// A few groups of the app's shortcuts dialog (apps/web `shortcut-list.tsx`); the Keyboard section lists them all.
const GROUPS = {
	navigation: ['goToToday', 'next', 'previous'],
	views: ['dayView', 'weekView', 'monthView'],
	general: ['openCommandMenu', 'showShortcuts'],
} as const satisfies Record<string, readonly ShownShortcut[]>;

type ShortcutsReplicaProps = {
	title: string;
	groups: Record<keyof typeof GROUPS, string>;
	actions: Record<ShownShortcut, string>;
};

/** The keyboard shortcuts dialog that `?` opens; on enter it opens once. */
export function ShortcutsReplica({ title, groups, actions }: ShortcutsReplicaProps) {
	const ref = useRef<HTMLDivElement>(null);

	useMotion(ref, () => {
		gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.4 })
			.from('[data-shortcuts-key]', { scale: 0.9, duration: 0.15, ease: 'power2.out' })
			.from('[data-shortcuts-dialog]', { autoAlpha: 0, y: 12, scale: 0.97, duration: 0.4, ease: 'power3.out' });
	});

	return (
		<div ref={ref} className='flex w-full max-w-sm flex-col items-center gap-4 text-xs/relaxed'>
			<span data-shortcuts-key className='flex items-center gap-2 rounded-lg border bg-popover px-2.5 py-1.5 shadow-lg'>
				<Hotkey keys={SHOWN_SHORTCUTS.showShortcuts} />
				<span className='text-muted-foreground'>{actions.showShortcuts}</span>
			</span>
			<div data-shortcuts-dialog className='flex w-full flex-col gap-4 rounded-xl bg-popover p-4 text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
				<p className='font-heading text-sm font-semibold'>{title}</p>
				{(Object.entries(GROUPS) as [keyof typeof GROUPS, readonly ShownShortcut[]][]).map(([group, list]) => (
					<section key={group} className='flex flex-col gap-1.5'>
						<h4 className='text-xs font-medium text-muted-foreground'>{groups[group]}</h4>
						<dl className='flex flex-col gap-1'>
							{list.map(action => (
								<div key={action} className='flex items-center justify-between gap-3'>
									<dt className='min-w-0 truncate'>{actions[action]}</dt>
									<dd className='shrink-0'>
										<Hotkey keys={SHOWN_SHORTCUTS[action]} />
									</dd>
								</div>
							))}
						</dl>
					</section>
				))}
			</div>
		</div>
	);
}
