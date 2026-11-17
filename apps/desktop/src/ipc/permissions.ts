import { fail, type OsPermission, type OsPermissionsStatus, ok } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import type { NotificationOutcome } from '../reminder-notifier';
import { type HandlerContext, handleRequest } from './handle';

/** The OS side of permissions, injected so tests can stand in for it. */
export type PermissionsIo = {
	/** Opens the OS privacy page for `permission`; false where the platform has none. */
	openSystemSettings: (permission: OsPermission) => Promise<boolean>;
	status: () => OsPermissionsStatus;
	/** Shows one notification and tells whether the OS showed or refused it. */
	testNotification: () => Promise<NotificationOutcome>;
};

/** `permissions:*`. They read and open OS state, never the database, so they run outside the use-case transactions. */
export const registerPermissionHandlers = (context: HandlerContext, io: PermissionsIo): void => {
	handleRequest(context, CHANNELS.permissions.status, async () => ok(io.status()));
	handleRequest(context, CHANNELS.permissions.openSystemSettings, async permission =>
		(await io.openSystemSettings(permission)) ? ok(null) : fail('internal', 'system.unexpected', { detail: `No system settings page for ${permission} on this platform` })
	);
	handleRequest(context, CHANNELS.permissions.testNotification, async () => {
		const outcome = await io.testNotification();
		return outcome.shown ? ok(null) : fail('internal', 'notifications.failed', { detail: `The OS refused the test notification: ${outcome.reason}` });
	});
};
