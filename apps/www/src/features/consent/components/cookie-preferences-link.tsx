'use client';

import { ConsentDialogLink } from 'c15t/next';
import { useConsentEnabled } from './consent-manager';

/** Reopens the cookie preferences dialog, so visitors can change their choice after the banner closes. */
export function CookiePreferencesLink({ label, className }: { label: string; className?: string }) {
	if (!useConsentEnabled()) return null;
	return <ConsentDialogLink className={className}>{label}</ConsentDialogLink>;
}
