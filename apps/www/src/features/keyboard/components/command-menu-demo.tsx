'use client';

import { cn } from 'cn';
import { SearchIcon } from 'lucide-react';
import { SHOWN_SHORTCUTS, type ShownShortcut } from '@/lib/hotkeys';
import { Hotkey } from './hotkey';

const ACTION_ITEMS = ['newEvent', 'goToDate', 'dayView', 'weekView', 'monthView', 'openSettings'] as const satisfies readonly ShownShortcut[];

export type CommandMenuCopy = {
	label: string;
	placeholder: string;
	groups: { actions: string; appearance: string; events: string };
	importIcs: string;
	exportAll: string;
	setTheme: string;
	setLanguage: string;
	shareAvailability: string;
	timeStats: string;
	/** With a `{query}` placeholder. */
	searchEvents: string;
};

type Item = { key: string; label: string; keys?: readonly string[] };

type CommandMenuDemoProps = {
	copy: CommandMenuCopy;
	actionLabels: Record<(typeof ACTION_ITEMS)[number], string>;
	typed: string;
	/** Flashes the selected item, as when Enter runs it. */
	pressed: boolean;
};

/** Static replica of the app's ⌘K menu (same commands, groups and classes); the section's timeline drives `typed`. */
export function CommandMenuDemo({ copy, actionLabels, typed, pressed }: CommandMenuDemoProps) {
	const query = typed.trim().toLowerCase();
	const matches = (item: Item) => query === '' || item.label.toLowerCase().includes(query);

	const groups: { key: string; heading: string; items: Item[] }[] = [
		{
			key: 'actions',
			heading: copy.groups.actions,
			items: [
				...ACTION_ITEMS.map(action => ({ key: action, label: actionLabels[action], keys: SHOWN_SHORTCUTS[action] })),
				{ key: 'shareAvailability', label: copy.shareAvailability },
				{ key: 'timeStats', label: copy.timeStats },
				{ key: 'importIcs', label: `${copy.importIcs} ›` },
				{ key: 'exportAll', label: copy.exportAll },
			].filter(matches),
		},
		{
			key: 'appearance',
			heading: copy.groups.appearance,
			items: [
				{ key: 'setTheme', label: `${copy.setTheme} ›` },
				{ key: 'setLanguage', label: `${copy.setLanguage} ›` },
			].filter(matches),
		},
		// Like the app, any text also offers to search events for it.
		{ key: 'events', heading: copy.groups.events, items: query === '' ? [] : [{ key: 'search', label: copy.searchEvents.replace('{query}', typed.trim()) }] },
	].filter(group => group.items.length > 0);

	const selected = groups[0]?.items[0]?.key;

	return (
		<div role='img' aria-label={copy.label} className='overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
			<div aria-hidden>
				<div className='flex h-10 items-center gap-2 border-b px-3 text-xs/relaxed'>
					<SearchIcon className='size-3.5 shrink-0 opacity-50' />
					<span className='flex min-w-0 items-center'>
						{typed === '' ? <span className='text-muted-foreground'>{copy.placeholder}</span> : <span className='truncate'>{typed}</span>}
						<span className='ml-px h-4 w-px animate-pulse bg-foreground' />
					</span>
				</div>
				{/* Fixed height, so the menu doesn't jump while the list filters. */}
				<div className='h-80 overflow-hidden p-1'>
					{groups.map(group => (
						<div key={group.key} className='p-1'>
							<p className='px-2.5 py-1.5 text-xs font-medium text-muted-foreground'>{group.heading}</p>
							{group.items.map(item => (
								<div
									key={item.key}
									className={cn(
										'flex min-h-7 items-center gap-2 rounded-md px-2.5 py-1.5 text-xs/relaxed transition-colors duration-150',
										item.key === selected && (pressed ? 'bg-foreground/20' : 'bg-muted')
									)}
								>
									<span className='truncate'>{item.label}</span>
									{item.keys && (
										<span className='ml-auto text-[0.625rem] tracking-widest text-muted-foreground'>
											<Hotkey keys={item.keys} />
										</span>
									)}
								</div>
							))}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
