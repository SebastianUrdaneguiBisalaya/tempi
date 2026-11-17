'use client';

import { ArrowUpRightIcon } from 'lucide-react';
import { useRef } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { gsap, useMotion } from '@/lib/gsap';
import { GITHUB_URL, SECTION_IDS } from '@/lib/site';

const QUESTIONS = ['free', 'data', 'account', 'offline', 'macos', 'windows', 'updates', 'languages'] as const;

type Answer = {
	question: string;
	answer: string;
	/** A shell command shown under the answer. */
	command?: string;
};

export type FaqCopy = {
	eyebrow: string;
	title: string;
	subtitle: string;
	askOnGitHub: string;
	items: Record<(typeof QUESTIONS)[number], Answer>;
};

export function FaqContent({ copy }: { copy: FaqCopy }) {
	const ref = useRef<HTMLElement>(null);

	useMotion(ref, () => {
		gsap.from('[data-faq-intro]', { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 70%' } });
		gsap.from('[data-faq-item]', { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out', scrollTrigger: { trigger: '[data-faq-item]', start: 'top 85%' } });
	});

	return (
		<section ref={ref} id={SECTION_IDS.faq} className='mx-auto w-full max-w-6xl px-4 sm:px-6'>
			<div className='grid gap-12 border-t py-24 md:py-32 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16'>
				<div className='lg:sticky lg:top-28 lg:self-start'>
					<p data-faq-intro className='text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase'>
						{copy.eyebrow}
					</p>
					<h2 data-faq-intro className='mt-4 font-heading text-4xl leading-[1.1] font-medium tracking-tight text-balance sm:text-5xl'>
						{copy.title}
					</h2>
					<p data-faq-intro className='mt-5 max-w-sm text-base leading-relaxed text-foreground/70'>
						{copy.subtitle}
					</p>
					<a
						data-faq-intro
						href={`${GITHUB_URL}/issues`}
						target='_blank'
						rel='noreferrer'
						className='mt-6 inline-flex items-center gap-1 rounded-sm text-sm font-medium underline-offset-4 hover:underline'
					>
						{copy.askOnGitHub}
						<ArrowUpRightIcon aria-hidden className='size-4' />
					</a>
				</div>
				<Accordion className='rounded-xl border'>
					{QUESTIONS.map(key => {
						const item = copy.items[key];
						return (
							<AccordionItem key={key} value={key} data-faq-item>
								<AccordionTrigger className='px-4 py-4 text-sm font-medium sm:px-5'>{item.question}</AccordionTrigger>
								<AccordionContent className='px-2 text-sm leading-relaxed text-muted-foreground sm:px-3'>
									<p>{item.answer}</p>
									{item.command && (
										<pre className='mt-3 overflow-x-auto rounded-md border bg-background px-3 py-2 font-mono text-xs text-foreground'>
											<code>{item.command}</code>
										</pre>
									)}
								</AccordionContent>
							</AccordionItem>
						);
					})}
				</Accordion>
			</div>
		</section>
	);
}
