'use client';

import { ConsentBanner, ConsentDialog, ConsentRoot } from 'c15t/next';
import { usePathname } from 'next/navigation';
import { createContext, use } from 'react';
import type { Dictionary } from '@/app/[lang]/dictionaries';
import { GTM_ID, isTrackedPath } from '@/lib/analytics';
import type { Locale } from '@/lib/i18n';

const ConsentEnabled = createContext(false);

/** True inside the consent root, so links that open the preferences dialog hide where there is none. */
export const useConsentEnabled = (): boolean => use(ConsentEnabled);

type ConsentManagerProps = {
	locale: Locale;
	copy: Dictionary['consent'];
	privacyLabel: string;
	children: React.ReactNode;
};

/**
 * The cookie banner and preferences dialog (c15t, configured in `c15t.config.ts`), which load Google Tag Manager only
 * after the visitor allows analytics. Off without a container ID, and on the pages Google's sign-in returns to.
 */
export function ConsentManager({ locale, copy, privacyLabel, children }: ConsentManagerProps) {
	const pathname = usePathname();
	if (!GTM_ID || !isTrackedPath(pathname)) return children;

	return (
		<ConsentEnabled value>
			{/* Keyed by locale: c15t reads `i18n` once, when the root mounts. */}
			<ConsentRoot
				key={locale}
				options={{
					i18n: { locale, messages: { [locale]: copy } },
					legalLinks: { privacyPolicy: { href: `/${locale}/privacy`, label: privacyLabel, target: '_self' } },
				}}
			>
				{children}
				<ConsentBanner position='bottom-right' legalLinks={['privacyPolicy']} primaryButton={['accept', 'reject']} hideBranding />
				<ConsentDialog legalLinks={['privacyPolicy']} hideBranding />
			</ConsentRoot>
		</ConsentEnabled>
	);
}
