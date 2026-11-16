'use client';

import { useShortcut } from '@/features/shortcuts/hooks/use-shortcut';
import { runUndo } from '@/lib/undo';
import { useNewEvent } from '../hooks/use-new-event';
import { useEventPanel } from './event-panel-provider';

/** Event keyboard shortcuts: `C` creates, ⌫/Delete deletes the open event (after confirming), ⌘Z undoes the last delete, Esc closes the panel. */
export function EventShortcuts() {
	const { close, requestDelete, selection } = useEventPanel();
	const newEvent = useNewEvent();

	useShortcut('newEvent', newEvent);
	useShortcut('deleteEvent', () => selection?.kind === 'event' && requestDelete(selection.event), { enabled: selection?.kind === 'event' });
	// Text fields keep their own ⌘Z.
	useShortcut('undo', () => runUndo(), { ignoreInputs: true });
	useShortcut('close', close, { enabled: selection !== null });

	return null;
}
