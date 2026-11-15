export const DOMAIN_ERROR_CODES = ['validation', 'not_found', 'conflict'] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

// Plain data instead of Error subclasses so results cross IPC unchanged.
export type DomainError = {
	code: DomainErrorCode;
	field?: string;
	message: string;
};

export type Result<T> = { ok: true; value: T } | { error: DomainError; ok: false };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const fail = <T = never>(code: DomainErrorCode, message: string, field?: string): Result<T> => ({
	error: field === undefined ? { code, message } : { code, field, message },
	ok: false,
});
