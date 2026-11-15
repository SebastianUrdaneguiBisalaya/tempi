import { stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { net, protocol } from 'electron';

// The packaged app serves the static export of @tempi/web (apps/web/out, copied by electron-builder's
// extraResources into <resources>/web) from app://tempi/ instead of file://, so absolute paths
// (/_next/...), fetch and storage behave like on a regular origin.
const APP_SCHEME = 'app';
const APP_HOST = 'tempi';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

// Must run before the app's `ready` event.
export function registerAppScheme() {
	protocol.registerSchemesAsPrivileged([
		{
			scheme: APP_SCHEME,
			privileges: { codeCache: true, secure: true, standard: true, supportFetchAPI: true },
		},
	]);
}

async function isFile(filePath: string) {
	try {
		return (await stat(filePath)).isFile();
	} catch {
		return false;
	}
}

// Next's static export writes routes as `route.html` (or `route/index.html` with trailingSlash).
function candidates(target: string) {
	return path.extname(target) ? [target] : [path.join(target, 'index.html'), `${target}.html`];
}

// Must run after the app's `ready` event.
export function handleAppProtocol(root: string) {
	const webRoot = path.resolve(root);

	protocol.handle(APP_SCHEME, async request => {
		const { host, pathname } = new URL(request.url);
		if (host !== APP_HOST) return new Response('Not found', { status: 404 });

		let relativePath: string;
		try {
			relativePath = decodeURIComponent(pathname);
		} catch {
			return new Response('Bad request', { status: 400 });
		}

		// path.join normalizes `..`; anything that ends up outside the export folder is refused.
		const target = path.join(webRoot, relativePath);
		if (target !== webRoot && !target.startsWith(`${webRoot}${path.sep}`)) {
			return new Response('Forbidden', { status: 403 });
		}

		for (const file of candidates(target)) {
			if (await isFile(file)) return net.fetch(pathToFileURL(file).toString());
		}

		const notFound = path.join(webRoot, '404.html');
		if (await isFile(notFound)) {
			const response = await net.fetch(pathToFileURL(notFound).toString());
			return new Response(response.body, { headers: response.headers, status: 404 });
		}
		return new Response('Not found', { status: 404 });
	});
}
