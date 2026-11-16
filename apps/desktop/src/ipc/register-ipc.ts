import type { CoreDeps, Settings } from '@tempi/core';
import type { OccurrenceRef } from '@tempi/ipc';
import { registerAppHandlers } from './app';
import { registerCalendarHandlers } from './calendars';
import { type DataIo, registerDataHandlers } from './data';
import { registerEventHandlers } from './events';
import type { HandlerContext } from './handle';
import { type IcalIo, registerIcalHandlers } from './ical';
import { registerOnboardingHandlers } from './onboarding';
import { registerProfileHandlers } from './profile';
import { registerSettingsHandlers } from './settings';

export type { DataIo } from './data';
export type { HandlerContext, IpcRegistrar, IpcSender } from './handle';
export type { IcalIo } from './ical';

/** Main-process reactions to committed changes made from the renderer. */
export type IpcListeners = {
	/** Events, or the calendars that show them, changed, e.g. to reschedule reminders. */
	eventsChanged?: () => void;
	/** The settings were saved, e.g. to sync `nativeTheme` with the selected theme. */
	settingsSaved?: (settings: Settings) => void;
	/** A window asked to show an occurrence in the main window. */
	showEvent?: (ref: OccurrenceRef) => void;
};

/** Registers every channel of the `@tempi/ipc` contract, each running its core use case against `deps`. */
/** The app's file work behind some channels, injected so tests can stand in for dialogs and files. */
export type AppIo = { data: DataIo; ical: IcalIo };

export const registerIpc = (context: HandlerContext, deps: CoreDeps, io: AppIo, listeners: IpcListeners = {}): void => {
	registerAppHandlers(context, listeners.showEvent);
	registerCalendarHandlers(context, deps, listeners.eventsChanged);
	registerEventHandlers(context, deps, listeners.eventsChanged);
	registerIcalHandlers(context, deps, io.ical, listeners.eventsChanged);
	registerDataHandlers(context, io.data);
	registerOnboardingHandlers(context, deps, listeners.settingsSaved);
	registerProfileHandlers(context, deps);
	registerSettingsHandlers(context, deps, listeners.settingsSaved);
};
