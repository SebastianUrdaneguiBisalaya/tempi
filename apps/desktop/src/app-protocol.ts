import { stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type CustomScheme, net, protocol } from 'electron';
import { CSP_HEADER } from './csp.js';

// The packaged app serves the static export of @tempi/web (apps/web/out, copied by electron-builder's
// extraResources into <resources>/web) from app://tempi/ instead of file://, so absolute paths
// (/_next/...), fetch and storage behave like on a regular origin.
const APP_SCHEME = 'app';
const APP_HOST = 'tempi';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/** Registered as privileged (with every other custom scheme, in one call) before the app's `ready` event. */
export const appScheme: CustomScheme = {
	scheme: APP_SCHEME,
	privileges: { codeCache: true, secure: true, standard: true, supportFetchAPI: true },
};

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

// Custom-protocol responses never pass through `session.webRequest`, so the policy is set here, on every response.
const withPolicy = (response: Response, policy: string): Response => {
	const headers = new Headers(response.headers);
	headers.set(CSP_HEADER, policy);
	return new Response(response.body, { headers, status: response.status, statusText: response.statusText });
};

// Must run after the app's `ready` event. `contentSecurityPolicy` goes out with every response.
export function handleAppProtocol(root: string, contentSecurityPolicy: string) {
	const webRoot = path.resolve(root);

	protocol.handle(APP_SCHEME, async request => withPolicy(await serve(request), contentSecurityPolicy));

	async function serve(request: Request): Promise<Response> {
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
	}
}
