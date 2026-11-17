'use client';

import { cn } from 'cn';
import { MinusIcon, SquarePenIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMediaQuery } from '@/hooks/use-media-query';
import type { AssistantTab } from '../assistant-store';
import { useAssistant, useAssistantPanel } from './assistant-provider';
import { ChatTab } from './chat-tab';
import { VoiceTab } from './voice-tab';

// Tailwind's `md`: below it the panel opens as a bottom drawer instead of floating.
const FLOATING_QUERY = '(min-width: 48rem)';

const isTab = (value: unknown): value is AssistantTab => value === 'chat' || value === 'voice';

/** The panel's content: Chat and Voice tabs over one conversation, New chat and Minimize. */
function AssistantPanel({ onEdit, onMinimize }: { onEdit: () => void; onMinimize: () => void }) {
	const { t } = useTranslation();
	const { clear, setTab, tab, turns } = useAssistant();
	return (
		<Tabs className='flex h-full min-h-0 flex-col gap-0' onValueChange={value => isTab(value) && setTab(value)} value={tab}>
			<div className='flex items-center gap-1 border-b px-2 py-1.5'>
				<TabsList>
					<TabsTrigger value='chat'>{t('assistant.tabs.chat')}</TabsTrigger>
					<TabsTrigger value='voice'>{t('assistant.tabs.voice')}</TabsTrigger>
				</TabsList>
				<Button aria-label={t('assistant.newChat')} className='ml-auto' disabled={turns.length === 0} onClick={clear} size='icon-sm' title={t('assistant.newChat')} variant='ghost'>
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

function LauncherIcon() {
	// The app's logo, from the static export's public folder.
	// biome-ignore lint/performance/noImgElement: a static export has no image optimizer; the icon is a local file.
	return <img alt='' className='size-7 rounded-full' height={28} src='/tempi-icon.png' width={28} />;
}

const launcherClass = (inset: boolean) =>
	cn(
		'fixed bottom-4 z-40 flex size-11 items-center justify-center rounded-full border bg-background shadow-lg transition-[right,transform] outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none motion-reduce:hover:scale-100',
		// Beside the inline right panel (w-72), never over it.
		inset ? 'right-[calc(18rem+1rem)]' : 'right-4'
	);

/**
 * The assistant: a launcher in the bottom-right corner and the panel it opens. Wide windows float the panel above the
 * launcher, non-modal so the calendar stays usable; narrow ones use a bottom drawer. Collapsing only hides it.
 */
export function Assistant({ inset }: { inset: boolean }) {
	const { t } = useTranslation();
	const floating = useMediaQuery(FLOATING_QUERY, true);
	const { open, setOpen } = useAssistantPanel();
	const label = t(open ? 'assistant.minimize' : 'assistant.open');
	const minimize = () => setOpen(false);
	// The event form opens in the right panel; on narrow windows that is a drawer the assistant's would cover.
	const onEdit = () => {
		if (!floating) setOpen(false);
	};

	if (floating)
		return (
			<Popover
				modal={false}
				onOpenChange={(next, details) => {
					// Clicking the calendar or moving focus to it keeps the panel open: only the launcher, ⌘J, Esc and Minimize collapse it.
					if (!next && (details.reason === 'outside-press' || details.reason === 'focus-out')) return;
					setOpen(next);
				}}
				open={open}
			>
				<PopoverTrigger aria-label={label} className={launcherClass(inset)} title={label}>
					<LauncherIcon />
				</PopoverTrigger>
				<PopoverContent
					align='end'
					aria-label={t('assistant.title')}
					className='h-[min(38rem,calc(100svh-7rem))] w-[min(26rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0 duration-200 motion-reduce:animate-none'
					side='top'
					sideOffset={12}
				>
					<AssistantPanel onEdit={onEdit} onMinimize={minimize} />
				</PopoverContent>
			</Popover>
		);

	return (
		<>
			<button aria-expanded={open} aria-label={label} className={launcherClass(false)} onClick={() => setOpen(!open)} title={label} type='button'>
				<LauncherIcon />
			</button>
			<Drawer onOpenChange={setOpen} open={open}>
				<DrawerContent className='h-[85svh]'>
					<DrawerHeader className='sr-only'>
						<DrawerTitle>{t('assistant.title')}</DrawerTitle>
					</DrawerHeader>
					<AssistantPanel onEdit={onEdit} onMinimize={minimize} />
				</DrawerContent>
			</Drawer>
		</>
	);
}
