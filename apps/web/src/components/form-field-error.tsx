'use client';

import { isErrorKey } from '@tempi/core';
import { issueTranslation } from '@tempi/i18n';
import type { FieldError as FormError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FieldError } from '@/components/ui/field';

/** Shows a form field's error, translated: messages are core error keys (from the schema, its error map or `setError`). */
export function FormFieldError({ error, id }: { error: FormError | undefined; id?: string }) {
	const { t } = useTranslation();
	const message = error?.message;
	if (message === undefined || message === '') return null;

	const fallback = t('validation.custom', { ns: 'errors' });
	if (!isErrorKey(message)) return <FieldError id={id}>{fallback}</FieldError>;
	const { key, options } = issueTranslation({ key: message });
	// A `defaultValue` selects i18next's untyped overload, since the key is only known at runtime (as in QueryProvider).
	return <FieldError id={id}>{t(key, { ...options, defaultValue: fallback })}</FieldError>;
}
