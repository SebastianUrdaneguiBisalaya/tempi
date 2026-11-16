import type { z } from 'zod';
import { ERROR_KEYS, type ErrorKey, isErrorKey } from './error-keys';

export const DOMAIN_ERROR_CODES = ['validation', 'not_found', 'conflict', 'internal'] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export type IssueParams = Record<string, number | string>;

export type DomainIssue = {
	/** English description for developers (logs, debugging). Never shown to users. */
	detail: string;
	/** Dot path of the offending field, when there is one. */
	field?: string;
	/** i18n key the UI translates, e.g. `validation.required`. */
	key: ErrorKey;
	/** Interpolation values for the translation, e.g. `{ maximum: 1440 }`. */
	params?: IssueParams;
};

// Plain data instead of Error subclasses so results cross IPC unchanged.
export type DomainError = {
	code: DomainErrorCode;
	/** Every problem found, never empty. */
	issues: DomainIssue[];
};

export type Result<T> = { ok: true; value: T } | { error: DomainError; ok: false };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

type FailOptions = { detail?: string; field?: string; params?: IssueParams };

/** A single-issue failure, for rules checked outside zod (not found, conflicts). */
export const fail = <T = never>(code: DomainErrorCode, key: ErrorKey, options: FailOptions = {}): Result<T> => {
	const issue: DomainIssue = { detail: options.detail ?? ERROR_KEYS[key], key };
	if (options.field !== undefined) issue.field = options.field;
	if (options.params !== undefined) issue.params = options.params;
	return { error: { code, issues: [issue] }, ok: false };
};

const zodIssueKey = (issue: { code: string }): ErrorKey => {
	const key = `validation.${issue.code}`;
	return isErrorKey(key) ? key : 'validation.custom';
};

/**
 * Per-parse error map that turns built-in zod messages into error keys.
 * Pass it to form resolvers (`zodResolver(schema, { error: zodErrorKeyMap })`) so field errors are always translatable.
 * Messages set on the schema take precedence over it.
 */
export const zodErrorKeyMap = (issue: { code: string }): ErrorKey => zodIssueKey(issue);

// Values zod puts on built-in issues that are useful for interpolating translations.
const PARAM_NAMES = ['divisor', 'expected', 'format', 'maximum', 'minimum', 'origin'] as const;

const issueParams = (issue: z.core.$ZodIssue): IssueParams | undefined => {
	const source: Record<string, unknown> = { ...issue };
	const params: IssueParams = {};
	for (const name of PARAM_NAMES) {
		const value = source[name];
		if (typeof value === 'number' || typeof value === 'string') params[name] = value;
		else if (typeof value === 'bigint') params[name] = value.toString();
	}
	return Object.keys(params).length > 0 ? params : undefined;
};

/** Schema messages are already keys; built-in zod messages become `validation.<code>` and are kept as `detail`. */
export const toDomainIssue = (issue: z.core.$ZodIssue): DomainIssue => {
	const domainIssue: DomainIssue = isErrorKey(issue.message) ? { detail: ERROR_KEYS[issue.message], key: issue.message } : { detail: issue.message, key: zodIssueKey(issue) };
	const field = issue.path.map(String).join('.');
	if (field !== '') domainIssue.field = field;
	const params = issueParams(issue);
	if (params !== undefined) domainIssue.params = params;
	return domainIssue;
};

/** Parses with a zod schema and reports every issue as a validation error. */
export const parseWith = <S extends z.ZodType>(schema: S, input: unknown): Result<z.output<S>> => {
	const parsed = schema.safeParse(input);
	if (parsed.success) return ok(parsed.data);
	return { error: { code: 'validation', issues: parsed.error.issues.map(toDomainIssue) }, ok: false };
};
