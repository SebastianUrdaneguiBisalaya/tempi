import type { DomainError } from '@tempi/core';
import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';

/** Puts a failed save's issues on the form fields they belong to (`avatar.bytes` → `avatar`); the toast shows the rest. */
export const showFieldErrors = <T extends FieldValues>(error: DomainError, setError: UseFormSetError<T>, isField: (field: string) => field is FieldPath<T>): void => {
	for (const issue of error.issues) {
		const field = issue.field?.split('.')[0] ?? '';
		if (isField(field)) setError(field, { message: issue.key });
	}
};
