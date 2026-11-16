'use client';

import { OCCURRENCE_SCOPES, type OccurrenceScope } from '@tempi/core';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FieldLabel } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useDialogShortcutScope } from '@/features/shortcuts/hooks/use-shortcut';

/** What a change to an occurrence of a recurring event asks before it runs. */
export type ScopeRequest = {
	action: 'delete' | 'edit';
	/** False when the change can't apply to one occurrence alone (its recurrence changed). */
	allowThis: boolean;
	title: string;
};

type OccurrenceScopeDialogProps = {
	onClose: (scope: OccurrenceScope | null) => void;
	request: ScopeRequest | null;
};

/** Asks whether a change applies to this occurrence, it and the following ones, or every occurrence. */
export function OccurrenceScopeDialog({ onClose, request }: OccurrenceScopeDialogProps) {
	const { t } = useTranslation();
	const id = useId();
	const scopes = OCCURRENCE_SCOPES.filter(scope => scope !== 'this' || request?.allowThis !== false);
	// Remembered per request: a new request starts from its first choice.
	const [choice, setChoice] = useState<{ request: ScopeRequest | null; scope: OccurrenceScope }>({ request: null, scope: 'this' });
	const scope = choice.request === request && scopes.includes(choice.scope) ? choice.scope : (scopes[0] ?? 'all');
	const isDelete = request?.action === 'delete';
	useDialogShortcutScope(request !== null);

	return (
		<AlertDialog onOpenChange={open => !open && onClose(null)} open={request !== null}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t(isDelete ? 'events.scope.deleteTitle' : 'events.scope.editTitle')}</AlertDialogTitle>
					<AlertDialogDescription>{t(isDelete ? 'events.scope.deleteDescription' : 'events.scope.editDescription', { title: request?.title ?? '' })}</AlertDialogDescription>
				</AlertDialogHeader>
				<RadioGroup className='gap-3' onValueChange={value => setChoice({ request, scope: OCCURRENCE_SCOPES.find(item => item === value) ?? scope })} value={scope}>
					{scopes.map(value => (
						<div className='flex items-center gap-2' key={value}>
							<RadioGroupItem id={`${id}-${value}`} value={value} />
							<FieldLabel className='font-normal' htmlFor={`${id}-${value}`}>
								{t(`events.scope.${value}`)}
							</FieldLabel>
						</div>
					))}
				</RadioGroup>
				<AlertDialogFooter>
					<AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
					<AlertDialogAction onClick={() => onClose(scope)} variant={isDelete ? 'destructive' : 'default'}>
						{t(isDelete ? 'actions.delete' : 'actions.save')}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
