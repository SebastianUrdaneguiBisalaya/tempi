'use client';

import { LANGUAGES, type Language, THEMES, type Theme } from '@tempi/core';
import type { CalendarView } from '@usecalendar/core';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command';
import { useCalendarNavigation } from '@/features/calendar/components/calendar-navigation-provider';
import { useGoToDate } from '@/features/calendar/components/go-to-date-provider';
import { useCalendars } from '@/features/calendar/hooks/use-calendars';
import { useExportCalendars, useImportCalendar } from '@/features/calendars/hooks/use-calendar-transfer';
import { EventSearchItems } from '@/features/events/components/event-search';
import { useNewEvent } from '@/features/events/hooks/use-new-event';
import { useSettingsDialog } from '@/features/settings/components/settings-dialog-provider';
import { useSaveSettings, useSettings } from '@/features/settings/hooks/use-settings';
import { useTour } from '@/features/tour/components/tour-provider';
import { nativeLanguageName } from '@/lib/language-name';
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
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const [page, setPage] = useState<Page>('root');
	const [text, setText] = useState('');
	// The event search follows the field without blocking typing.
	const searched = useDeferredValue(text);
	const { setView } = useCalendarNavigation();
	const { openGoToDate } = useGoToDate();
	const { openSettings } = useSettingsDialog();
	const newEvent = useNewEvent();
	const { data: settings } = useSettings();
	const saveSettings = useSaveSettings();
	const { data: calendars } = useCalendars();
	const importCalendar = useImportCalendar();
	const exportCalendars = useExportCalendars();
	const { startTour } = useTour();

	useShortcut('openCommandMenu', () => setOpen(true));
	useDialogShortcutScope(open);

	const changeOpen = (next: boolean) => {
		setOpen(next);
		if (next) return;
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
							<CommandGroup heading={t('commandMenu.groups.actions')}>
								{actionItem('newEvent', newEvent)}
								{actionItem('goToDate', openGoToDate)}
								{(Object.entries(VIEW_ACTIONS) as [CalendarView, ShortcutAction][]).map(([view, action]) => actionItem(action, () => setView(view)))}
								{actionItem('openSettings', openSettings)}
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
