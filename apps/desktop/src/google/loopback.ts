import { createServer } from 'node:http';

/** How waiting for the browser ended: Google redirected back (with a code or an error), time ran out, or it was aborted. */
export type RedirectOutcome = { kind: 'redirect'; params: URLSearchParams } | { kind: 'timeout' } | { kind: 'aborted' };

export type LoopbackOptions = {
	/** Only a redirect carrying this `state` is accepted; anything else gets a 400 and the wait goes on. */
	state: string;
	/** The page the browser shows once redirected, by whether a code came back. */
	page: (succeeded: boolean) => string;
	signal: AbortSignal;
	timeoutMs: number;
};

export type LoopbackRedirect = {
	/** Where Google sends the browser back: this listener, on an ephemeral port of the IPv4 loopback. */
	redirectUri: string;
	outcome: Promise<RedirectOutcome>;
};

const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`);

/** A minimal page for the browser tab the sign-in ends in. */
export const redirectPage = (title: string, message: string): string =>
	`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:0 16px;color-scheme:light dark}</style></head><body><p>${escapeHtml(message)}</p></body></html>`;

/**
 * Listens on 127.0.0.1 for Google's redirect (RFC 8252 loopback). Only 127.0.0.1 is bound, so other machines can't
 * reach it; the server closes as soon as the wait ends, whichever way.
 */
export const listenForRedirect = async (options: LoopbackOptions): Promise<LoopbackRedirect> => {
	const { promise: outcome, resolve: settle } = Promise.withResolvers<RedirectOutcome>();

	const server = createServer((request, response) => {
		const params = new URL(request.url ?? '/', 'http://127.0.0.1').searchParams;
		const isRedirect = request.method === 'GET' && (params.has('code') || params.has('error'));
		if (!isRedirect || params.get('state') !== options.state) {
			response.writeHead(isRedirect ? 400 : 404).end();
			return;
		}
		const succeeded = params.has('code') && !params.has('error');
		response
			.writeHead(200, {
				'Cache-Control': 'no-store',
				Connection: 'close',
				'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
				'Content-Type': 'text/html; charset=utf-8',
			})
			.end(options.page(succeeded));
		finish({ kind: 'redirect', params });
	});

	let timer: ReturnType<typeof setTimeout> | undefined;
	let done = false;
	const onAbort = () => finish({ kind: 'aborted' });

	function finish(result: RedirectOutcome) {
		if (done) return;
		done = true;
		clearTimeout(timer);
		options.signal.removeEventListener('abort', onAbort);
		server.close();
		server.closeIdleConnections();
		settle(result);
	}

	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => resolve());
	});
	const address = server.address();
	if (address === null || typeof address === 'string') {
		finish({ kind: 'aborted' });
		throw new Error('The loopback listener has no TCP port');
	}
	timer = setTimeout(() => finish({ kind: 'timeout' }), options.timeoutMs);
	if (options.signal.aborted) onAbort();
	else options.signal.addEventListener('abort', onAbort, { once: true });

	return { outcome, redirectUri: `http://127.0.0.1:${address.port}` };
};
