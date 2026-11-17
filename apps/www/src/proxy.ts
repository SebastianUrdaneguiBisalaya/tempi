import { match } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';
import { type NextRequest, NextResponse } from 'next/server';
import { defaultLocale, locales } from '@/lib/i18n';

function preferredLocale(request: NextRequest): string {
	const languages = new Negotiator({ headers: { 'accept-language': request.headers.get('accept-language') ?? '' } }).languages();
	try {
		return match(languages, locales, defaultLocale);
	} catch {
		// A malformed Accept-Language makes `match` throw; fall back instead of failing the request.
		return defaultLocale;
	}
}

export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const hasLocale = locales.some(locale => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
	if (hasLocale) return;

	request.nextUrl.pathname = `/${preferredLocale(request)}${pathname === '/' ? '' : pathname}`;
	return NextResponse.redirect(request.nextUrl);
}

export const config = {
	// Skip Next internals and any path with a file extension (public assets, favicon, sitemap, robots).
	matcher: ['/((?!_next/|.*\\..*).*)'],
};
