import { stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { AVATAR_HOST, AVATAR_SCHEME } from '@tempi/ipc';
import { type CustomScheme, net, protocol } from 'electron';
import { avatarPath } from './avatar-store.js';

/** Registered as privileged (with the app scheme) before the app's `ready` event. */
export const avatarScheme: CustomScheme = { privileges: { secure: true, standard: true }, scheme: AVATAR_SCHEME };

const isFile = async (filePath: string) => {
	try {
		return (await stat(filePath)).isFile();
	} catch {
		return false;
	}
};

/** Serves stored avatars, read-only, from `tempi-avatar://local/<file name>`. Must run after the app's `ready` event. */
export function handleAvatarProtocol(dir: string) {
	protocol.handle(AVATAR_SCHEME, async request => {
		const { host, pathname } = new URL(request.url);
		if (host !== AVATAR_HOST || request.method !== 'GET') return new Response('Not found', { status: 404 });

		let fileName: string;
		try {
			fileName = decodeURIComponent(pathname.slice(1));
		} catch {
			return new Response('Bad request', { status: 400 });
		}

		// Only bare avatar file names resolve, so nothing else in userData (the database) can be read.
		const target = avatarPath(dir, fileName);
		if (target === null || !(await isFile(target))) return new Response('Not found', { status: 404 });
		return net.fetch(pathToFileURL(target).toString());
	});
}
