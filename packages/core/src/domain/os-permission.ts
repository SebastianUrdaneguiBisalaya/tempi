import { z } from 'zod';

/** The OS permissions Tempi uses: notifications for reminders, the microphone for dictation and voice. */
export const OS_PERMISSIONS = ['notifications', 'microphone'] as const;

/**
 * What the OS allows. `unknown`: the OS manages it but doesn't tell the app (notifications on every platform today).
 * `unsupported`: the OS has no per-app setting for it, or can't provide it at all.
 */
export const OS_PERMISSION_STATES = ['granted', 'denied', 'not-determined', 'unknown', 'unsupported'] as const;

export type OsPermission = (typeof OS_PERMISSIONS)[number];
export type OsPermissionState = (typeof OS_PERMISSION_STATES)[number];

export const osPermissionSchema = z.enum(OS_PERMISSIONS);

const osPermissionStatusSchema = z.object({
	/** Whether Tempi can open the OS page where the user changes it. */
	canOpenSettings: z.boolean(),
	state: z.enum(OS_PERMISSION_STATES),
});

/** The OS state of each permission, as the main process reads it. */
export const osPermissionsStatusSchema = z.object({ microphone: osPermissionStatusSchema, notifications: osPermissionStatusSchema });

export type OsPermissionStatus = z.output<typeof osPermissionStatusSchema>;
export type OsPermissionsStatus = z.output<typeof osPermissionsStatusSchema>;
