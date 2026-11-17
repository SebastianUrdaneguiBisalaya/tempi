/** What a permission request asks for, as Electron describes it (`media` requests list their media types). */
export type PermissionAsk = { permission: string; requestingUrl: string; mediaTypes?: readonly string[] | undefined };

/** What a permission check asks about. Electron checks by origin, and names one media type. */
export type PermissionCheck = { permission: string; requestingOrigin: string; mediaType?: string | undefined };

/** Only dictation needs a permission: the microphone, for the app itself. Camera, screen and the rest stay denied. */
const isAudioOnly = (mediaTypes: readonly string[] | undefined): boolean => mediaTypes !== undefined && mediaTypes.length > 0 && mediaTypes.every(type => type === 'audio');

export type PermissionPolicy = {
	isTrusted: (url: string) => boolean;
	/**
	 * Whether the OS lets the app use the microphone, asking the user the first time (macOS). Resolves true where the OS
	 * has no such prompt.
	 */
	microphoneAccess: () => Promise<boolean>;
};

/** For `session.setPermissionRequestHandler`: everything is denied except audio capture from the app's own origin. */
export const createPermissionRequestHandler =
	({ isTrusted, microphoneAccess }: PermissionPolicy) =>
	({ mediaTypes, permission, requestingUrl }: PermissionAsk): Promise<boolean> => {
		if (permission !== 'media' || !isTrusted(requestingUrl) || !isAudioOnly(mediaTypes)) return Promise.resolve(false);
		return microphoneAccess().catch(() => false);
	};

/** For `session.setPermissionCheckHandler`: the same rule, answered synchronously. */
export const isPermissionCheckAllowed = ({ mediaType, permission, requestingOrigin }: PermissionCheck, isTrusted: (url: string) => boolean): boolean =>
	permission === 'media' && mediaType === 'audio' && isTrusted(requestingOrigin);

/** The parts of Electron's `systemPreferences` the macOS microphone prompt needs. */
export type MicrophonePreferences = {
	getMediaAccessStatus: (mediaType: 'microphone') => string;
	askForMediaAccess: (mediaType: 'microphone') => Promise<boolean>;
};

/**
 * On macOS the app must be allowed in System Settings › Privacy & Security › Microphone: ask once, then respect the
 * user's answer. Other platforms have no per-app prompt that Electron can show.
 */
export const microphoneAccess = (platform: NodeJS.Platform, preferences: MicrophonePreferences) => (): Promise<boolean> => {
	if (platform !== 'darwin') return Promise.resolve(true);
	const status = preferences.getMediaAccessStatus('microphone');
	if (status === 'not-determined') return preferences.askForMediaAccess('microphone');
	return Promise.resolve(status === 'granted');
};
