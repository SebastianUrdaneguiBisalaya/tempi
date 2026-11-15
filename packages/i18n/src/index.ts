import type { DomainIssue, ErrorKey, IssueParams, Language } from '@tempi/core';
import { en } from './locales/en';
import { es } from './locales/es';
import type { LeafPaths, Messages } from './types';

export const NAMESPACES = ['common', 'errors'] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const DEFAULT_NAMESPACE = 'common' satisfies Namespace;
export const FALLBACK_LANGUAGE = 'en' satisfies Language;

export type Translations = typeof en;

/** i18next-shaped resources: `resources[language][namespace]`. One entry per language core supports. */
export const resources = { en, es } as const satisfies Record<Language, Messages<Translations>>;

// Compile-time guard: fails the typecheck, naming the key, if core adds an error key without a translation.
type MissingErrorKeys = Exclude<ErrorKey, LeafPaths<Translations['errors']>>;
const _everyErrorKeyIsTranslated: [MissingErrorKeys] extends [never] ? true : MissingErrorKeys = true;

/** Arguments for `t()`: the issue key in the `errors` namespace, interpolated with its params. */
export const issueTranslation = (issue: Pick<DomainIssue, 'key' | 'params'>): { key: ErrorKey; options: IssueParams & { ns: 'errors' } } => ({
	key: issue.key,
	options: { ...issue.params, ns: 'errors' },
});

export type { LeafPaths, Messages } from './types';
