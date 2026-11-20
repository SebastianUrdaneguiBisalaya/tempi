'use client';

import { AnthropicDark, AnthropicLight, OpenAIDark, OpenAILight } from '@ridemountainpig/svgl-react';
import { cn } from 'cn';
import { Trash2Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { onEnter } from '@/components/showcase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { gsap, useMotion } from '@/lib/gsap';

type Provider = { title: string; description: string };

export type ProviderKeysCopy = {
	keyPlaceholder: string;
	saveKey: string;
	keySaved: string;
	testKey: string;
	removeKey: string;
	providers: { anthropic: Provider; openai: Provider };
};

// A pasted key, as the password field shows it.
const PASTED_KEY = 'sk-proj-7Hq2vX9kLm4Rt8Wz';

type ProviderCardProps = { logo: ReactNode; provider: Provider; children: ReactNode };

function ProviderCard({ logo, provider, children }: ProviderCardProps) {
	return (
		<Card size='sm'>
			<CardHeader>
				<div className='flex items-center gap-3'>
					<span className='flex size-8 shrink-0 items-center justify-center'>{logo}</span>
					<div className='flex min-w-0 flex-col gap-0.5'>
						<CardTitle>{provider.title}</CardTitle>
						<CardDescription>{provider.description}</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent className='flex flex-col items-start gap-4'>{children}</CardContent>
		</Card>
	);
}

/** Replica of Settings › Integrations' provider cards (apps/web `ai-integrations.tsx`); on enter, a key is pasted and saved. */
export function ProviderKeysReplica({ copy }: { copy: ProviderKeysCopy }) {
	const ref = useRef<HTMLDivElement>(null);
	const [key, setKey] = useState(PASTED_KEY);
	const [saving, setSaving] = useState(false);

	useMotion(ref, () => {
		setKey('');
		gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.6 })
			.call(() => setKey(PASTED_KEY))
			.call(() => setSaving(true), [], '+=0.6')
			.call(() => setSaving(false), [], '+=1.2');
		return () => {
			setKey(PASTED_KEY);
			setSaving(false);
		};
	});

	return (
		<div ref={ref} className='flex w-full max-w-md flex-col gap-3 text-xs/relaxed'>
			<ProviderCard
				provider={copy.providers.anthropic}
				logo={
					<>
						<AnthropicLight className='size-8 dark:hidden' />
						<AnthropicDark className='hidden size-8 dark:block' />
					</>
				}
			>
				<div className='flex w-full flex-wrap items-center gap-2'>
					<p className='mr-auto font-mono text-muted-foreground' title={copy.keySaved}>
						••••••••••••
					</p>
					<Button size='sm' variant='outline'>
						{copy.testKey}
					</Button>
					<Button size='sm' variant='outline'>
						<Trash2Icon data-icon='inline-start' />
						{copy.removeKey}
					</Button>
				</div>
			</ProviderCard>
			<ProviderCard
				provider={copy.providers.openai}
				logo={
					<>
						<OpenAILight className='size-8 dark:hidden' />
						<OpenAIDark className='hidden size-8 dark:block' />
					</>
				}
			>
				<div className='flex w-full flex-col gap-2 sm:flex-row sm:items-start'>
					<Input className='flex-1' placeholder={copy.keyPlaceholder} readOnly tabIndex={-1} type='password' value={key} />
					<Button className={cn('transition-transform', saving && 'scale-95')} disabled={key === ''}>
						{saving && <Spinner data-icon='inline-start' />}
						{copy.saveKey}
					</Button>
				</div>
			</ProviderCard>
		</div>
	);
}
