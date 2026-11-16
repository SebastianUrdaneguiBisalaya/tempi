'use client';

import { DEFAULT_SETTINGS } from '@tempi/core';
import { useCalendarNavigation } from '@/features/calendar/components/calendar-navigation-provider';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { useShortcut } from '@/features/shortcuts/hooks/use-shortcut';
import { nextDraft } from '@/lib/event-draft';
import { runUndo } from '@/lib/undo';
import { useEventPanel } from './event-panel-provider';

/** Event keyboard shortcuts: `C` creates, ⌫/Delete deletes the open event (after confirming), ⌘Z undoes the last delete, Esc closes the panel. */
export function EventShortcuts() {
	const { date, timeZone } = useCalendarNavigation();
	const { close, newEvent, requestDelete, selection } = useEventPanel();
	const { data: settings } = useSettings();
	const duration = settings?.defaultEventDuration ?? DEFAULT_SETTINGS.defaultEventDuration;

	useShortcut('newEvent', () => date !== null && newEvent(nextDraft(date, timeZone, duration)));
	useShortcut('deleteEvent', () => selection?.kind === 'event' && requestDelete(selection.event), { enabled: selection?.kind === 'event' });
	// Text fields keep their own ⌘Z.
	useShortcut('undo', () => runUndo(), { ignoreInputs: true });
	useShortcut('close', close, { enabled: selection !== null });

	return null;
}
