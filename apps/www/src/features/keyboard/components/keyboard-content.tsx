'use client';

import { useRef, useState } from 'react';
import { onEnter, ShowcaseCell, ShowcaseGrid, ShowcaseSection } from '@/components/showcase';
import type { MockupCopy } from '@/features/why/components/app-mockup';
import { gsap, useMotion } from '@/lib/gsap';
import { SHOWN_SHORTCUTS, type ShownShortcut } from '@/lib/hotkeys';
import type { Locale } from '@/lib/i18n';
import { type CommandMenuCopy, CommandMenuDemo } from './command-menu-demo';
import { Hotkey } from './hotkey';
import { NavigationReplica } from './navigation-replica';
import { type NewEventCopy, NewEventReplica } from './new-event-replica';
import { type UndoCopy, UndoReplica } from './undo-replica';

const SHORTCUT_GROUPS = {
	navigation: ['goToToday', 'next', 'previous', 'goToDate'],
	views: ['dayView', 'weekView', 'monthView'],
	events: ['newEvent', 'undo'],
	general: ['openCommandMenu', 'showShortcuts', 'openSettings', 'togglePanel'],
} as const satisfies Record<string, readonly ShownShortcut[]>;

type GroupKey = keyof typeof SHORTCUT_GROUPS;

type Cell = { title: string; body: string };

export type KeyboardCopy = {
	eyebrow: string;
	title: string;
	subtitle: string;
	/** What the demo types into the command menu. */
	query: string;
	commandMenu: CommandMenuCopy;
	cells: Record<'commandMenu' | 'navigation' | 'newEvent' | 'undo', Cell>;
	replicas: { newEvent: NewEventCopy; undo: UndoCopy };
	groups: Record<GroupKey, string>;
	actions: Record<ShownShortcut, string>;
};

const TYPE_DELAY = 0.14;

type KeyboardContentProps = {
	locale: Locale;
	copy: KeyboardCopy;
	/** The hero's names, so the replicas show the same calendar. */
	mockup: MockupCopy;
};

/** The ⌘K menu filtering as a word is typed, once, when it scrolls in. */
function CommandMenuCell({ copy }: { copy: KeyboardCopy }) {
	const ref = useRef<HTMLDivElement>(null);
	const [typed, setTyped] = useState(copy.query);
	const [pressed, setPressed] = useState(false);

	useMotion(ref, () => {
		setTyped('');
		const demo = gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.6 });
		for (let index = 1; index <= copy.query.length; index++) {
			demo.call(() => setTyped(copy.query.slice(0, index)), [], `+=${TYPE_DELAY}`);
		}
		demo.call(() => setPressed(true), [], '+=0.8').call(() => setPressed(false), [], '+=0.35');
		return () => {
			setTyped(copy.query);
			setPressed(false);
		};
	});

	return (
		<div ref={ref} className='w-full max-w-md'>
			<CommandMenuDemo copy={copy.commandMenu} actionLabels={copy.actions} typed={typed} pressed={pressed} />
		</div>
	);
}

export function KeyboardContent({ locale, copy, mockup }: KeyboardContentProps) {
	const { cells, replicas } = copy;
	return (
		<ShowcaseSection index={6} eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle}>
			<ShowcaseGrid>
				<ShowcaseCell title={cells.commandMenu.title} body={cells.commandMenu.body}>
					<CommandMenuCell copy={copy} />
				</ShowcaseCell>
				<ShowcaseCell align='center' title={cells.navigation.title} body={cells.navigation.body}>
					<NavigationReplica locale={locale} today={mockup.today} actions={copy.actions} />
				</ShowcaseCell>
				<ShowcaseCell align='center' title={cells.newEvent.title} body={cells.newEvent.body}>
					<NewEventReplica copy={replicas.newEvent} calendarName={mockup.calendars.work} />
				</ShowcaseCell>
				<ShowcaseCell align='center' title={cells.undo.title} body={cells.undo.body}>
					<UndoReplica
						copy={replicas.undo}
						events={[
							{ title: mockup.events.standup, calendar: 'work', start: 9, end: 10 },
							{ title: mockup.events.focus, calendar: 'project', start: 10.5, end: 12 },
							{ title: mockup.events.lunch, calendar: 'personal', start: 12.5, end: 13.5 },
						]}
					/>
				</ShowcaseCell>
			</ShowcaseGrid>
			<div className='grid gap-8 border-b py-10 sm:grid-cols-2 md:px-8 lg:grid-cols-4'>
				{(Object.entries(SHORTCUT_GROUPS) as [GroupKey, readonly ShownShortcut[]][]).map(([group, actions]) => (
					<div key={group} data-showcase-cell>
						<h3 className='text-xs font-medium text-muted-foreground'>{copy.groups[group]}</h3>
						<ul className='mt-2'>
							{actions.map(action => (
								<li key={action} className='flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm'>
									<span className='text-foreground/85'>{copy.actions[action]}</span>
									<Hotkey keys={SHOWN_SHORTCUTS[action]} />
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
		</ShowcaseSection>
	);
}
