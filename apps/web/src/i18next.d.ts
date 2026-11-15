import type { DEFAULT_NAMESPACE, Translations } from '@tempi/i18n';

// Types `t()` keys and namespaces against the shared English resources.
declare module 'i18next' {
	interface CustomTypeOptions {
		defaultNS: typeof DEFAULT_NAMESPACE;
		resources: Translations;
	}
}
