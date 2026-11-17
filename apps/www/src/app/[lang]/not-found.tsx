import { cn } from 'cn';
import Image from 'next/image';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { getDictionary, getLocale } from './dictionaries';

export default async function NotFound() {
	const [locale, { notFound: copy }] = await Promise.all([getLocale(), getDictionary()]);

	return (
		<main className='relative isolate flex h-svh w-full items-center justify-center overflow-hidden px-4 text-center'>
			<Image src='/bg-tempi-footer.png' alt='' fill priority sizes='100vw' className='-z-10 object-cover object-bottom' />
			<div className='absolute inset-x-0 top-0 -z-10 h-1/3 bg-linear-to-b from-background to-transparent' />
			<div className='flex max-w-md flex-col items-center'>
				<p className='font-mono text-sm tracking-[0.3em] text-foreground/60'>404</p>
				<h1 className='mt-4 font-heading text-4xl font-medium tracking-tight text-balance sm:text-5xl'>{copy.title}</h1>
				<p className='mt-4 text-base leading-relaxed text-foreground/70'>{copy.body}</p>
				<Link
					href={`/${locale}`}
					className={cn(buttonVariants({ variant: 'outline', className: 'mt-8 h-11 rounded-full border-foreground/15 bg-background/30! px-5 text-sm backdrop-blur-md' }))}
				>
					{copy.back}
				</Link>
			</div>
		</main>
	);
}
