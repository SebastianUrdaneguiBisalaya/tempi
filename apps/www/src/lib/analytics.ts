import type { DOWNLOADS } from './downloads';
import type { Locale } from './i18n';
import type { Platform } from './platform';

/** Google Tag Manager container. Unset in local dev and previews, so they load neither GTM nor the cookie banner. */
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim() || undefined;

// Google's sign-in sends the browser back to these pages; the privacy policy promises they receive nothing.
const UNTRACKED_PAGES = /^\/[^/]+\/(signed-in|sign-in-failed)\/?$/;

export const isTrackedPath = (pathname: string): boolean => !UNTRACKED_PAGES.test(pathname);

type DownloadVariant = (typeof DOWNLOADS)[Platform][number]['key'];

/** Every event the landing page sends to GTM, with its parameters. GTM's triggers and GA4's dimensions use these names. */
type AnalyticsEvents = {
	author_click: Record<never, never>;
	download_click: { platform: Platform; source: 'download_section' | 'hero'; variant: DownloadVariant };
	faq_open: { question: string };
	github_click: { source: 'faq' | 'footer' | 'header' | 'header_menu' };
	language_change: { from: Locale; to: Locale };
};

export type AnalyticsEvent = keyof AnalyticsEvents;

export type AnalyticsParams<E extends AnalyticsEvent> = AnalyticsEvents[E];

type DataLayer = { push: (entry: Record<string, unknown>) => unknown };

/**
 * Pushes one event to GTM's data layer. Until the visitor allows analytics, c15t hasn't loaded GTM and there is no data
 * layer, so nothing is queued to be sent later.
 */
export function track<E extends AnalyticsEvent>(event: E, params: AnalyticsParams<E>, target: { dataLayer?: DataLayer; locale?: string } = browserTarget()): void {
	target.dataLayer?.push({ event, locale: target.locale, ...params });
}

function browserTarget(): { dataLayer?: DataLayer; locale?: string } {
	if (typeof window === 'undefined') return {};
	const dataLayer = (window as { dataLayer?: DataLayer }).dataLayer;
	return { dataLayer, locale: document.documentElement.lang };
}
