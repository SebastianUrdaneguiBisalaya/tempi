import { CheckIcon, XIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { getDictionary } from '@/app/[lang]/dictionaries';

type Outcome = 'done' | 'failed';

/** The browser tab the desktop app's Google sign-in ends in; not worth indexing. */
export async function signInMetadata(outcome: Outcome): Promise<Metadata> {
	const { signIn } = await getDictionary();
	return { title: `${signIn[outcome].title} · Tempi`, robots: { index: false, follow: false } };
}

export async function SignInResult({ outcome }: { outcome: Outcome }) {
	const { signIn } = await getDictionary();
	const copy = signIn[outcome];
	const StatusIcon = outcome === 'done' ? CheckIcon : XIcon;

	return (
		<main className='relative isolate flex h-svh w-full items-center justify-center overflow-hidden px-4 text-center'>
			<Image src='/bg-tempi-footer.png' alt='' fill priority sizes='100vw' className='-z-20 object-cover object-bottom' />
			{/* Dims the illustration so the message reads on top of it. */}
			<div className='absolute inset-0 -z-10 bg-background/45' />
			<div className='absolute inset-x-0 top-0 -z-10 h-1/3 bg-linear-to-b from-background to-transparent' />
			<div className='flex max-w-md flex-col items-center'>
				<div className='relative'>
					<Image src='/tempi-icon.png' alt='Tempi' width={96} height={96} priority className='size-24' />
					<span className='absolute right-1 bottom-1 flex size-7 items-center justify-center rounded-full border border-foreground/15 bg-background/70 backdrop-blur-md'>
						<StatusIcon aria-hidden className='size-4' />
					</span>
				</div>
				<h1 className='mt-6 font-heading text-4xl font-medium tracking-tight text-balance sm:text-5xl'>{copy.title}</h1>
				<p className='mt-4 text-base leading-relaxed text-foreground/70'>{copy.body}</p>
			</div>
		</main>
	);
}
