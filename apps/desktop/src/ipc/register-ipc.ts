import type { CoreDeps, Settings, Theme } from '@tempi/core';
import type { OccurrenceRef } from '@tempi/ipc';
import type { UpdateService } from '../updates/update-service';
import { type AiIo, registerAiHandlers } from './ai';
import { registerAppHandlers } from './app';
import { registerCalendarHandlers } from './calendars';
import { type DataIo, registerDataHandlers } from './data';
import { registerEventHandlers } from './events';
import { type GoogleIo, registerGoogleHandlers } from './google';
import type { HandlerContext } from './handle';
import { type IcalIo, registerIcalHandlers } from './ical';
import { registerOnboardingHandlers } from './onboarding';
import { type PermissionsIo, registerPermissionHandlers } from './permissions';
import { registerProfileHandlers } from './profile';
import { registerSettingsHandlers } from './settings';
import { registerUpdateHandlers } from './updates';

export type { AiIo } from './ai';
export type { DataIo } from './data';
export type { GoogleIo } from './google';
export type { HandlerContext, IpcRegistrar, IpcSender } from './handle';
export type { IcalIo } from './ical';
export type { PermissionsIo } from './permissions';

/** Main-process reactions to committed changes made from the renderer. */
export type IpcListeners = {
	/** Events, or the calendars that show them, changed, e.g. to reschedule reminders. */
	eventsChanged?: () => void;
	/** The profile was saved, e.g. to count the icon badge in its time zone. */
	profileSaved?: () => void;
	/** The settings were saved, e.g. to sync `nativeTheme` with the selected theme. */
	settingsSaved?: (settings: Settings) => void;
	/** The renderer previews an unsaved theme, or drops the preview (null), e.g. to sync `nativeTheme` with it. */
	themePreviewed?: (theme: Theme | null) => void;
	/** A window asked to show an occurrence in the main window. */
	showEvent?: (ref: OccurrenceRef) => void;
};

/** The app's work outside the database behind some channels, injected so tests can stand in for dialogs, files, AI providers, Google, OS permissions and updates. */
export type AppIo = { ai: AiIo; data: DataIo; google: GoogleIo; ical: IcalIo; permissions: PermissionsIo; updates: UpdateService };

/** Registers every channel of the `@tempi/ipc` contract, each running its core use case against `deps`. */

export const registerIpc = (context: HandlerContext, deps: CoreDeps, io: AppIo, listeners: IpcListeners = {}): void => {
	registerAiHandlers(context, io.ai);
	registerAppHandlers(context, listeners.showEvent);
	registerCalendarHandlers(context, deps, listeners.eventsChanged);
	registerEventHandlers(context, deps, listeners.eventsChanged);
	registerIcalHandlers(context, deps, io.ical, listeners.eventsChanged);
	registerDataHandlers(context, io.data);
	registerGoogleHandlers(context, deps, io.google, listeners.eventsChanged);
	registerOnboardingHandlers(context, deps, listeners.settingsSaved);
	registerPermissionHandlers(context, io.permissions);
	registerProfileHandlers(context, deps, listeners.profileSaved);
	registerSettingsHandlers(context, deps, listeners.settingsSaved, listeners.themePreviewed);
	registerUpdateHandlers(context, io.updates);
};
