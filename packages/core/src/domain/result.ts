import type { z } from 'zod';

export const DOMAIN_ERROR_CODES = ['validation', 'not_found', 'conflict'] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

// Plain data instead of Error subclasses so results cross IPC unchanged.
export type DomainError = {
	code: DomainErrorCode;
	/** Dot path of the offending field, when there is one. */
	field?: string;
	/** i18n key, e.g. `validation.required`. */
	message: string;
};

export type Result<T> = { ok: true; value: T } | { error: DomainError; ok: false };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const fail = <T = never>(code: DomainErrorCode, message: string, field?: string): Result<T> => ({
	error: field === undefined || field === '' ? { code, message } : { code, field, message },
	ok: false,
});

/** Parses with a zod schema and reports the first issue as a validation error. */
export const parseWith = <S extends z.ZodType>(schema: S, input: unknown): Result<z.output<S>> => {
	const parsed = schema.safeParse(input);
	if (parsed.success) return ok(parsed.data);
	const [issue] = parsed.error.issues;
	return fail('validation', issue?.message ?? 'validation.invalid', issue?.path.join('.'));
};
