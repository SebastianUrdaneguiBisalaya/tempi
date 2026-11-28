import { googleTagManager } from '@c15t/integrations/google-tag-manager';
import { defineConsentConfig, local } from 'c15t/next';
import { GTM_ID } from './src/lib/analytics';

// Tempi has no backend, so consent lives only in the visitor's browser. `local()` asks everyone (no IP lookup means the
// strict opt-in rules for an unknown location), which is what the privacy policy promises.
export default defineConsentConfig({
	mode: local({ acknowledgeNoRecords: true }),
	// `after-consent`: nothing reaches Google until the visitor allows analytics, so the dataLayer doesn't exist before.
	scripts: GTM_ID ? [googleTagManager({ id: GTM_ID, loadMode: 'after-consent', category: 'measurement' })] : [],
	options: { consentCategories: ['necessary', 'measurement'] },
});
