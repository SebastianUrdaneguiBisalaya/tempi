'use client';

import { DEFAULT_SETTINGS } from '@tempi/core';
import { useHotkeys } from '@usehotkeys/react';
import { useCalendarNavigation } from '@/features/calendar/components/calendar-navigation-provider';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { nextDraft } from '@/lib/event-draft';
import { runUndo } from '@/lib/undo';
import { useEventPanel } from './event-panel-provider';

/** Event keyboard shortcuts: `C` creates, ⌫/Delete deletes the open event (after confirming), ⌘Z undoes the last delete. */
export function EventShortcuts() {
	const { date, timeZone } = useCalendarNavigation();
	const { newEvent, requestDelete, selection } = useEventPanel();
	const { data: settings } = useSettings();
	const duration = settings?.defaultEventDuration ?? DEFAULT_SETTINGS.defaultEventDuration;

	useHotkeys('c', () => date !== null && newEvent(nextDraft(date, timeZone, duration)), { label: 'New event' });
	useHotkeys(['backspace', 'delete'], () => selection?.kind === 'event' && requestDelete(selection.event), { enabled: selection?.kind === 'event', label: 'Delete event' });
	// Text fields keep their own ⌘Z.
	useHotkeys('mod+z', () => runUndo(), { ignoreInputs: true, label: 'Undo' });

	return null;
}
