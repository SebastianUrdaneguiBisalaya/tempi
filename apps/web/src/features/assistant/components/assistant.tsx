'use client';

import { MinusIcon, SquarePenIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShortcutKeys } from '@/features/shortcuts/components/shortcut-keys';
import { SHORTCUTS } from '@/features/shortcuts/shortcuts';
import type { AssistantTab } from '../assistant-store';
import { assistantFocusTarget, useAssistant, useAssistantPanel, useAssistantRequests } from './assistant-provider';
import { ChatTab } from './chat-tab';
import { VoiceTab } from './voice-tab';

const isTab = (value: unknown): value is AssistantTab => value === 'chat' || value === 'voice';

/** The panel's content: Chat and Voice tabs over one conversation, New chat and Minimize. */
function AssistantPanel({ onEdit, onMinimize }: { onEdit: () => void; onMinimize: () => void }) {
	const { t } = useTranslation();
	const tab = useAssistant(state => state.tab);
	const setTab = useAssistant(state => state.setTab);
	const empty = useAssistant(state => state.turns.length === 0);
	const { clear } = useAssistantRequests();
	return (
		<Tabs className='flex h-full min-h-0 flex-col gap-0' onValueChange={value => isTab(value) && setTab(value)} value={tab}>
			<div className='flex items-center gap-1 border-b px-2 py-1.5'>
				<TabsList>
					<TabsTrigger value='chat'>{t('assistant.tabs.chat')}</TabsTrigger>
					<TabsTrigger value='voice'>{t('assistant.tabs.voice')}</TabsTrigger>
				</TabsList>
				<Button aria-label={t('assistant.newChat')} className='ml-auto' disabled={empty} onClick={clear} size='icon-sm' title={t('assistant.newChat')} variant='ghost'>
					<SquarePenIcon />
				</Button>
				<Button aria-label={t('assistant.minimize')} onClick={onMinimize} size='icon-sm' title={t('assistant.minimize')} variant='ghost'>
					<MinusIcon />
				</Button>
			</div>
			<TabsContent className='flex min-h-0 flex-1 flex-col' value='chat'>
				<ChatTab onEdit={onEdit} />
			</TabsContent>
			<TabsContent className='flex min-h-0 flex-1 flex-col' value='voice'>
				<VoiceTab onEdit={onEdit} />
			</TabsContent>
		</Tabs>
	);
}

/** The app's logo: a white glyph, shown on a dark tile (a light one, with the glyph inverted, in dark mode). */
function TempiMark() {
	return (
		<span aria-hidden className='flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-foreground shadow-xs'>
			{/* biome-ignore lint/performance/noImgElement: a static export has no image optimizer; the icon is a local file. */}
			<img alt='' className='size-12 max-w-none dark:invert' height={48} src='/tempi-icon.png' width={48} />
		</span>
	);
}

const ENTRY_CLASS =
	'group/ask flex w-full items-center gap-2.5 rounded-lg border border-primary/15 bg-linear-to-br from-primary/10 via-sidebar to-sidebar p-2 text-left text-sidebar-foreground shadow-xs outline-none transition-[border-color,background-color,box-shadow] hover:border-primary/30 hover:from-primary/15 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-sidebar-ring aria-expanded:border-primary/30 aria-expanded:from-primary/15 motion-reduce:transition-none';

/** The entry's content: the logo, "Ask Tempi" and the ⌘J keys. */
function EntryContent() {
	const { t } = useTranslation();
	return (
		<>
			<TempiMark />
			<span className='min-w-0 flex-1 truncate font-medium text-xs'>{t('assistant.entry.label')}</span>
			<ShortcutKeys keys={[SHORTCUTS.openAssistantChat.keys]} />
		</>
	);
}

type AssistantEntryProps = {
	/**
	 * True while the entry is on screen in the inline sidebar: the panel floats beside it. Otherwise (narrow windows,
	 * where the sidebar is a drawer) the entry only opens `AssistantDrawer`.
	 */
	anchored: boolean;
	/** Runs before the drawer opens, e.g. to close the sidebar drawer the entry sits in. */
	onOpenDrawer?: () => void;
};

/**
 * "Ask Tempi" at the bottom of the left sidebar. In the inline sidebar the panel floats beside it, non-modal so the
 * calendar stays usable; only the entry, its tab's shortcut (⌘J, ⌘⇧J), Esc and Minimize close it.
 */
export function AssistantEntry({ anchored, onOpenDrawer }: AssistantEntryProps) {
	const { t } = useTranslation();
	const { open, setOpen } = useAssistantPanel();
	const label = t(open ? 'assistant.minimize' : 'assistant.open');

	if (!anchored)
		return (
			<button
				aria-expanded={open}
				aria-label={label}
				className={ENTRY_CLASS}
				onClick={() => {
					onOpenDrawer?.();
					setOpen(!open);
				}}
				type='button'
			>
				<EntryContent />
			</button>
		);

	return (
		<Popover
			modal={false}
			onOpenChange={(next, details) => {
				// Clicking the calendar or moving focus to it keeps the panel open.
				if (!next && (details.reason === 'outside-press' || details.reason === 'focus-out')) return;
				setOpen(next);
			}}
			open={open}
		>
			<PopoverTrigger aria-label={label} className={ENTRY_CLASS}>
				<EntryContent />
			</PopoverTrigger>
			<PopoverContent
				align='end'
				aria-label={t('assistant.title')}
				className='h-[min(38rem,calc(100svh-2rem))] w-[min(26rem,calc(100vw-18rem))] gap-0 overflow-hidden p-0 duration-200 motion-reduce:animate-none'
				initialFocus={() => assistantFocusTarget() ?? true}
				side='right'
				sideOffset={12}
			>
				<AssistantPanel onEdit={() => undefined} onMinimize={() => setOpen(false)} />
			</PopoverContent>
		</Popover>
	);
}

/**
 * The panel as a bottom drawer, used whenever the sidebar entry isn't on screen to anchor it: narrow windows and the
 * collapsed sidebar. ⌘J, ⌘⇧J and the entry open it.
 */
export function AssistantDrawer() {
	const { t } = useTranslation();
	const { open, setOpen } = useAssistantPanel();
	const minimize = () => setOpen(false);
	return (
		<Drawer onOpenChange={setOpen} open={open}>
			<DrawerContent className='h-[85svh]' initialFocus={() => assistantFocusTarget() ?? true}>
				<DrawerHeader className='sr-only'>
					<DrawerTitle>{t('assistant.title')}</DrawerTitle>
				</DrawerHeader>
				{/* The event form opens in the right panel, which this drawer would cover: make way for it. */}
				<AssistantPanel onEdit={minimize} onMinimize={minimize} />
			</DrawerContent>
		</Drawer>
	);
}
