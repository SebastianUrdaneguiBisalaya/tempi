'use client';

import { PlusIcon, XIcon } from 'lucide-react';
import { useId } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export type GuestsCopy = {
	label: string;
	placeholder: string;
	add: string;
	/** With an `{email}` placeholder. */
	remove: string;
	hint: string;
	/** The demo's guests. */
	emails: string[];
};

/**
 * The event form's guests field (apps/web `guests-field.tsx`) with a few guests added. The input group copies the
 * classes of the app's `input-group` (`InputGroup`, `InputGroupInput`, `InputGroupAddon`, `InputGroupButton`), which
 * the landing doesn't ship.
 */
export function GuestsReplica({ copy }: { copy: GuestsCopy }) {
	const id = useId();
	const hintId = `${id}-hint`;

	return (
		<div className='flex w-full max-w-sm flex-col gap-3 rounded-xl bg-popover p-4 text-xs/relaxed text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
			<Field>
				<FieldLabel htmlFor={id}>{copy.label}</FieldLabel>
				<div
					data-slot='input-group'
					role='group'
					className='group/input-group relative flex h-7 w-full min-w-0 items-center rounded-md border border-input bg-input/20 transition-colors outline-none dark:bg-input/30 has-[>[data-align=inline-end]]:[&>input]:pr-1.5'
				>
					<Input
						aria-describedby={hintId}
						className='flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 dark:bg-transparent'
						data-slot='input-group-control'
						id={id}
						placeholder={copy.placeholder}
						readOnly
						tabIndex={-1}
						type='email'
					/>
					<div
						role='group'
						data-slot='input-group-addon'
						data-align='inline-end'
						className='order-last flex h-auto items-center justify-center gap-1 py-2 pr-2 text-xs/relaxed font-medium text-muted-foreground select-none has-[>button]:mr-[-0.275rem]'
					>
						<Button
							aria-label={copy.add}
							className='flex size-6 items-center gap-2 rounded-md p-0 text-xs/relaxed shadow-none has-[>svg]:p-0'
							size='icon-xs'
							tabIndex={-1}
							title={copy.add}
							variant='ghost'
						>
							<PlusIcon aria-hidden />
						</Button>
					</div>
				</div>
				<ul aria-label={copy.label} className='flex flex-wrap gap-1.5'>
					{copy.emails.map(email => (
						<li className='min-w-0 max-w-full' key={email}>
							<Badge className='max-w-full gap-1 pr-0.5' variant='secondary'>
								<span className='truncate'>{email}</span>
								<button
									aria-label={copy.remove.replace('{email}', email)}
									className='inline-flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-ring'
									tabIndex={-1}
									type='button'
								>
									<XIcon aria-hidden className='size-3' />
								</button>
							</Badge>
						</li>
					))}
				</ul>
				<FieldDescription id={hintId}>{copy.hint}</FieldDescription>
			</Field>
		</div>
	);
}
