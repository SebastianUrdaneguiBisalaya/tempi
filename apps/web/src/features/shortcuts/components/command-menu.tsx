'use client';

import { DEFAULT_SETTINGS, LANGUAGES, type Language, type QuickAddProposal, resolveLanguage, THEMES, type Theme } from '@tempi/core';
import type { CalendarView } from '@usecalendar/core';
import { SparklesIcon } from 'lucide-react';
import { useDeferredValue, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command';
import { Spinner } from '@/components/ui/spinner';
import { useShareAvailability } from '@/features/availability/components/share-availability-provider';
import { useCalendarNavigation } from '@/features/calendar/components/calendar-navigation-provider';
import { useGoToDate } from '@/features/calendar/components/go-to-date-provider';
import { useCalendars } from '@/features/calendar/hooks/use-calendars';
import { useExportCalendars, useImportCalendar } from '@/features/calendars/hooks/use-calendar-transfer';
import { useEventPanel } from '@/features/events/components/event-panel-provider';
import { EventSearchItems } from '@/features/events/components/event-search';
import { useNewEvent } from '@/features/events/hooks/use-new-event';
import { useProfile } from '@/features/profile/hooks/use-profile';
import { useTimeZone } from '@/features/profile/hooks/use-time-zone';
import { useSettingsDialog } from '@/features/settings/components/settings-dialog-provider';
import { quickAddProviderOf, useAiQuickAdd, useAiSettings } from '@/features/settings/hooks/use-ai';
import { useSaveSettings, useSettings } from '@/features/settings/hooks/use-settings';
import { useStats } from '@/features/stats/components/stats-provider';
import { useTour } from '@/features/tour/components/tour-provider';
import { formatDate, formatTimeRange } from '@/lib/date-format';
import { nativeLanguageName } from '@/lib/language-name';
import { parseQuickAdd, type QuickAddEvent } from '@/lib/quick-add';
import { useDialogShortcutScope, useShortcut } from '../hooks/use-shortcut';
import { type ShortcutAction, shortcutKeysOf } from '../shortcuts';
import { ShortcutKeys } from './shortcut-keys';

/** Root lists every command; the others are the choices behind "Set theme to ›", "Set language to ›", "Import .ics into ›" and the event search. */
type Page = 'import' | 'language' | 'root' | 'search' | 'theme';

const VIEW_ACTIONS = { day: 'dayView', month: 'monthView', week: 'weekView' } as const satisfies Record<CalendarView, ShortcutAction>;

/**
 * ⌘K: runs any main action from the keyboard. Typing filters the commands and offers to search events for the text.
 * Backspace on an empty field goes back from a sub-page.
 */
export function CommandMenu() {
	const { i18n, t } = useTranslation();
	const [open, setOpen] = useState(false);
	const [page, setPage] = useState<Page>('root');
	const [text, setText] = useState('');
	// The event search follows the field without blocking typing.
	const searched = useDeferredValue(text);
	const { setView } = useCalendarNavigation();
	const { openGoToDate } = useGoToDate();
	const { openShareAvailability } = useShareAvailability();
	const { openStats } = useStats();
	const { openSettings } = useSettingsDialog();
	const newEvent = useNewEvent();
	const { newEvent: openDraft } = useEventPanel();
	const { data: settings } = useSettings();
	const { data: profile } = useProfile();
	const timeZone = useTimeZone();
	const saveSettings = useSaveSettings();
	const { data: calendars } = useCalendars();
	const importCalendar = useImportCalendar();
	const exportCalendars = useExportCalendars();
	const { startTour } = useTour();
	const { data: aiSettings } = useAiSettings();
	const aiProvider = quickAddProviderOf(aiSettings);
	const aiQuickAdd = useAiQuickAdd();
	// Counts AI reads, so an answer that arrives after the menu closed, or after a newer read, opens nothing.
	const aiRead = useRef(0);

	useShortcut('openCommandMenu', () => setOpen(true));
	useDialogShortcutScope(open);

	const changeOpen = (next: boolean) => {
		setOpen(next);
		if (next) return;
		aiRead.current++;
		aiQuickAdd.reset();
		setPage('root');
		setText('');
	};

	const showPage = (next: Page) => {
		setPage(next);
		// The search page keeps the typed text as its query; the others start a fresh filter.
		if (next !== 'search') setText('');
	};

	/** Closes the menu, then runs the command, so a dialog it opens takes the focus. */
	const run = (command: () => void) => () => {
		changeOpen(false);
		command();
	};

	const actionItem = (action: ShortcutAction, command: () => void) => {
		const label = t(`shortcuts.actions.${action}`);
		return (
			<CommandItem key={action} onSelect={run(command)} value={label}>
				{label}
				<CommandShortcut>
					<ShortcutKeys keys={shortcutKeysOf(action)} />
				</CommandShortcut>
			</CommandItem>
		);
	};

	const language = resolveLanguage([i18n.language]);
	// Typed text with a date offers to create an event from it. Nothing is saved until the form is.
	const quickAdd =
		page === 'root' && text.trim() !== ''
			? parseQuickAdd(text, {
					country: profile?.country ?? null,
					defaultDuration: settings?.defaultEventDuration ?? DEFAULT_SETTINGS.defaultEventDuration,
					language,
					now: Temporal.Now.instant(),
					timeZone,
				})
			: null;
	const quickAddWhen = (event: QuickAddEvent) => {
		const options = { language, timeFormat: settings?.timeFormat ?? DEFAULT_SETTINGS.timeFormat, timeZone };
		const day = formatDate(event.startAt, options, 'medium');
		return event.allDay ? day : `${day} · ${formatTimeRange(event.startAt, event.endAt, options)}`;
	};

	const openQuickAdd = (event: QuickAddEvent) => openDraft({ allDay: event.allDay, endAt: event.endAt, startAt: event.startAt, values: event.title === '' ? {} : { title: event.title } });

	const openProposal = (proposal: QuickAddProposal) =>
		openDraft({
			allDay: proposal.allDay,
			endAt: proposal.endAt,
			startAt: proposal.startAt,
			values: {
				title: proposal.title,
				...(proposal.location === null ? {} : { location: proposal.location }),
				...(proposal.description === null ? {} : { description: proposal.description }),
				// Without one asked for, the form keeps its usual reminder.
				...(proposal.reminderMinutes === null ? {} : { reminderMinutes: proposal.reminderMinutes }),
			},
		});

	/**
	 * Sends the text to the chosen provider only now that the user picked the item, never while typing. The menu stays
	 * open while it reads; a failure (already toasted) falls back to what the local parser read, if anything.
	 */
	const createWithAi = (typed: string, local: QuickAddEvent | null) => {
		if (aiQuickAdd.isPending) return;
		const read = ++aiRead.current;
		aiQuickAdd.mutate(typed.trim(), {
			onError: () => {
				if (read !== aiRead.current || local === null) return;
				changeOpen(false);
				openQuickAdd(local);
			},
			onSuccess: proposal => {
				if (read !== aiRead.current) return;
				changeOpen(false);
				openProposal(proposal);
			},
		});
	};

	const aiItemContent = (label: string) =>
		aiQuickAdd.isPending ? (
			<>
				<Spinner />
				<span className='truncate'>{t('commandMenu.aiReading')}</span>
			</>
		) : (
			<>
				<SparklesIcon aria-hidden />
				<span className='truncate'>{label}</span>
			</>
		);

	const setTheme = (theme: Theme) => saveSettings.mutate({ theme });
	const setLanguage = (language: Language) => saveSettings.mutate({ language });

	return (
		<CommandDialog description={t('commandMenu.description')} onOpenChange={changeOpen} open={open} title={t('commandMenu.title')}>
			<Command
				label={t('commandMenu.title')}
				onKeyDown={event => {
					if (event.key !== 'Backspace' || text !== '' || page === 'root') return;
					event.preventDefault();
					showPage('root');
				}}
				// Search results are already matched by the database.
				shouldFilter={page !== 'search'}
			>
				<CommandInput aria-label={t(`commandMenu.placeholders.${page}`)} onValueChange={setText} placeholder={t(`commandMenu.placeholders.${page}`)} value={text} />
				<CommandList>
					{page === 'root' && (
						<>
							<CommandEmpty>{t('commandMenu.empty')}</CommandEmpty>
							{/* First, so Enter creates the event the text describes. */}
							{quickAdd !== null && (
								<CommandGroup forceMount heading={t('commandMenu.groups.create')}>
									<CommandItem
										aria-busy={aiQuickAdd.isPending || undefined}
										forceMount
										onSelect={aiProvider === null ? run(() => openQuickAdd(quickAdd)) : () => createWithAi(text, quickAdd)}
										value={`quick-add:${text}`}
									>
										{aiProvider === null ? (
											<span className='truncate'>{quickAdd.title === '' ? t('commandMenu.createEvent') : t('commandMenu.createNamedEvent', { title: quickAdd.title })}</span>
										) : (
											aiItemContent(quickAdd.title === '' ? t('commandMenu.createEvent') : t('commandMenu.createNamedEvent', { title: quickAdd.title }))
										)}
										<span className='ml-auto shrink-0 text-muted-foreground'>{quickAddWhen(quickAdd)}</span>
									</CommandItem>
								</CommandGroup>
							)}
							<CommandGroup heading={t('commandMenu.groups.actions')}>
								{actionItem('newEvent', newEvent)}
								{actionItem('goToDate', openGoToDate)}
								{(Object.entries(VIEW_ACTIONS) as [CalendarView, ShortcutAction][]).map(([view, action]) => actionItem(action, () => setView(view)))}
								{actionItem('openSettings', openSettings)}
								<CommandItem onSelect={run(openShareAvailability)} value={t('commandMenu.shareAvailability')}>
									{t('commandMenu.shareAvailability')}
								</CommandItem>
								<CommandItem onSelect={run(openStats)} value={t('commandMenu.timeStats')}>
									{t('commandMenu.timeStats')}
								</CommandItem>
								<CommandItem onSelect={() => showPage('import')} value={t('commandMenu.importIcs')}>
									{t('commandMenu.importIcs')} ›
								</CommandItem>
								<CommandItem onSelect={run(() => exportCalendars.mutate(null))} value={t('commandMenu.exportAll')}>
									{t('commandMenu.exportAll')}
								</CommandItem>
								<CommandItem onSelect={run(startTour)} value={t('tour.replay')}>
									{t('tour.replay')}
								</CommandItem>
							</CommandGroup>
							<CommandGroup heading={t('commandMenu.groups.appearance')}>
								<CommandItem onSelect={() => showPage('theme')} value={t('commandMenu.setTheme')}>
									{t('commandMenu.setTheme')} ›
								</CommandItem>
								<CommandItem onSelect={() => showPage('language')} value={t('commandMenu.setLanguage')}>
									{t('commandMenu.setLanguage')} ›
								</CommandItem>
							</CommandGroup>
							{/* Text the local parser finds no date in can still describe an event to the AI; listed after the commands so Enter keeps running them. */}
							{quickAdd === null && aiProvider !== null && text.trim() !== '' && (
								<CommandGroup forceMount heading={t('commandMenu.groups.create')}>
									<CommandItem aria-busy={aiQuickAdd.isPending || undefined} forceMount onSelect={() => createWithAi(text, null)} value={`quick-add-ai:${text}`}>
										{aiItemContent(t('commandMenu.createWithAi', { text: text.trim() }))}
									</CommandItem>
								</CommandGroup>
							)}
							{text.trim() !== '' && (
								<CommandGroup forceMount heading={t('commandMenu.groups.events')}>
									<CommandItem forceMount onSelect={() => showPage('search')} value={`search:${text}`}>
										{t('commandMenu.searchEvents', { query: text.trim() })}
									</CommandItem>
								</CommandGroup>
							)}
						</>
					)}
					{page === 'theme' && (
						<CommandGroup heading={t('commandMenu.setTheme')}>
							{THEMES.map(theme => (
								<CommandItem data-checked={settings?.theme === theme} key={theme} onSelect={run(() => setTheme(theme))} value={t(`onboarding.theme.options.${theme}`)}>
									{t(`onboarding.theme.options.${theme}`)}
								</CommandItem>
							))}
						</CommandGroup>
					)}
					{page === 'import' && (
						<CommandGroup heading={t('commandMenu.importIcs')}>
							{calendars?.map(calendar => (
								<CommandItem key={calendar.id} onSelect={run(() => importCalendar.mutate(calendar.id))} value={`${calendar.name} ${calendar.id}`}>
									<span aria-hidden className='size-3 shrink-0 rounded-sm' style={{ backgroundColor: calendar.color }} />
									{calendar.name}
								</CommandItem>
							))}
						</CommandGroup>
					)}
					{page === 'language' && (
						<CommandGroup heading={t('commandMenu.setLanguage')}>
							{LANGUAGES.map(language => (
								<CommandItem
									data-checked={settings?.language === language}
									key={language}
									lang={language}
									onSelect={run(() => setLanguage(language))}
									value={nativeLanguageName(language)}
								>
									{nativeLanguageName(language)}
								</CommandItem>
							))}
						</CommandGroup>
					)}
					{page === 'search' && searched.trim() !== '' && <EventSearchItems onShown={() => changeOpen(false)} query={searched} />}
				</CommandList>
			</Command>
		</CommandDialog>
	);
}
