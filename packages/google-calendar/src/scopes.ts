/** A granted scope as Google returns it (space-separated) or as a list. */
export type GrantedScopes = string | readonly string[];

const scopeSet = (granted: GrantedScopes): Set<string> => new Set(typeof granted === 'string' ? granted.split(' ').filter(scope => scope !== '') : granted);

/** The scopes in `required` that `granted` lacks, in the order they were required. */
export const missingScopes = (granted: GrantedScopes, required: readonly string[]): string[] => {
	const have = scopeSet(granted);
	return required.filter(scope => !have.has(scope));
};

/** True when `granted` covers every scope in `required`. */
export const hasScopes = (granted: GrantedScopes, required: readonly string[]): boolean => missingScopes(granted, required).length === 0;
