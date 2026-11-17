import { createHash } from 'node:crypto';
import { AVATAR_SCHEME } from '@tempi/ipc';
import { z } from 'zod';

/**
 * Content-Security-Policy for the renderer. Packaged, it runs only Tempi's own code: scripts from the app origin plus
 * the exact inline scripts of the static export, pinned by hash. The dev policy is a separate one because `next dev`
 * needs eval and unhashed inline scripts for hot reload; nothing from it ever reaches the packaged app.
 */

/** Sent with every response of the app protocol (and of the dev server) under this name. */
export const CSP_HEADER = 'Content-Security-Policy';

/** Where the desktop build writes the hashes of the static export's inline scripts, next to the bundled main process. */
export const CSP_HASHES_FILE = 'csp-hashes.json';

const hashSchema = z.string().regex(/^sha256-[A-Za-z0-9+/]{43}=$/);

export const cspHashesSchema = z.array(hashSchema);

type Directives = Record<string, readonly string[]>;

const AVATAR_SOURCE = `${AVATAR_SCHEME}:`;

// Shared by both policies: nothing loads from the network, nothing embeds or frames the app, no plugins, forms or <base>.
const BASE: Directives = {
	'default-src': ["'self'"],
	'style-src': ["'self'", "'unsafe-inline'"],
	// `blob:` is the avatar preview before it's saved; stored avatars come from their own read-only scheme.
	'img-src': ["'self'", 'blob:', AVATAR_SOURCE],
	'font-src': ["'self'"],
	'connect-src': ["'self'"],
	'media-src': ["'self'"],
	'worker-src': ["'none'"],
	'frame-src': ["'none'"],
	'object-src': ["'none'"],
	'manifest-src': ["'none'"],
	'base-uri': ["'none'"],
	'form-action': ["'none'"],
	'frame-ancestors': ["'none'"],
};

const serialize = (directives: Directives): string =>
	Object.entries(directives)
		.map(([name, sources]) => [name, ...sources].join(' '))
		.join('; ');

/** The packaged app's policy: scripts only from the app origin and the inline scripts with these hashes. */
export const productionCsp = (inlineScriptHashes: readonly string[]): string => {
	const hashes = cspHashesSchema.parse([...new Set(inlineScriptHashes)]).map(hash => `'${hash}'`);
	return serialize({ ...BASE, 'script-src': ["'self'", ...hashes] });
};

/** The dev server's policy: what `next dev` needs for hot reload (eval, inline scripts, its HMR websocket), nothing more. */
export const developmentCsp = (devServerUrl: string): string => {
	const { host, protocol } = new URL(devServerUrl);
	const socket = `${protocol === 'https:' ? 'wss' : 'ws'}://${host}`;
	return serialize({
		...BASE,
		'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
		'connect-src': ["'self'", socket],
	});
};

const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const SRC_ATTRIBUTE = /(?:^|\s)src\s*=/i;

/** CSP hashes (`sha256-…`) of every inline `<script>` in an HTML document, as the browser computes them. */
export const inlineScriptHashes = (html: string): string[] =>
	Array.from(html.matchAll(INLINE_SCRIPT))
		.filter(([, attributes = '', body = '']) => !SRC_ATTRIBUTE.test(attributes) && body !== '')
		.map(([, , body = '']) => `sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}`);

/** Response headers with the policy set, replacing any CSP the response already carried (header names are case-insensitive). */
export const withCsp = (headers: Record<string, string[]>, policy: string): Record<string, string[]> => {
	const kept = Object.entries(headers).filter(([name]) => name.toLowerCase() !== CSP_HEADER.toLowerCase());
	return { ...Object.fromEntries(kept), [CSP_HEADER]: [policy] };
};
