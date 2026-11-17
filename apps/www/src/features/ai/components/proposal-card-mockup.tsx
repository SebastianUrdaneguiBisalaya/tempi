import { cn } from 'cn';
import { CalendarPlusIcon, CheckIcon, PencilIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker';
import { Spinner } from '@/components/ui/spinner';

export type ProposalCopy = {
	create: string;
	title: string;
	when: string;
	calendar: string;
	confirm: string;
	edit: string;
	saved: string;
	event: { title: string; when: string; calendar: string };
};

export type ProposalStatus = 'pending' | 'confirming' | 'saved';

/** Static replica of the app's proposal card (apps/web `proposal-card.tsx`) for a new event. */
export function ProposalCardMockup({ copy, status }: { copy: ProposalCopy; status: ProposalStatus }) {
	return (
		<Card className='w-full' size='sm'>
			<CardHeader>
				<CardTitle className='flex items-center gap-2'>
					<CalendarPlusIcon className='size-3.5 text-muted-foreground' />
					{copy.create}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className='grid grid-cols-[auto_1fr] gap-x-3 gap-y-1'>
					<dt className='text-muted-foreground'>{copy.title}</dt>
					<dd className='font-medium'>{copy.event.title}</dd>
					<dt className='text-muted-foreground'>{copy.when}</dt>
					<dd>{copy.event.when}</dd>
					<dt className='text-muted-foreground'>{copy.calendar}</dt>
					<dd className='flex items-center gap-1.5'>
						<span className='size-2 shrink-0 rounded-full bg-emerald-500' />
						{copy.event.calendar}
					</dd>
				</dl>
			</CardContent>
			<CardFooter className='gap-2'>
				{status === 'saved' ? (
					<Marker>
						<MarkerIcon>
							<CheckIcon />
						</MarkerIcon>
						<MarkerContent>{copy.saved}</MarkerContent>
					</Marker>
				) : (
					<>
						{/* Pressed while saving, as when the visitor's own click lands. */}
						<Button size='sm' className={cn('transition-transform', status === 'confirming' && 'scale-95')}>
							{status === 'confirming' && <Spinner data-icon='inline-start' />}
							{copy.confirm}
						</Button>
						<Button size='sm' variant='outline'>
							<PencilIcon data-icon='inline-start' />
							{copy.edit}
						</Button>
					</>
				)}
			</CardFooter>
		</Card>
	);
}
