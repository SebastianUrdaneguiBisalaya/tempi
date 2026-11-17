import { SECTION_IDS } from '@/lib/site';
import { getDictionary } from './dictionaries';

export default async function LandingPage() {
	const { meta } = await getDictionary();
	// Placeholders until the landing sections land; each section issue replaces its own.
	return (
		<main className='flex flex-1 flex-col'>
			<div className='flex min-h-svh flex-col items-center justify-center gap-2 p-6 text-center'>
				<h1 className='font-heading text-3xl'>{meta.title}</h1>
				<p className='text-muted-foreground'>{meta.description}</p>
			</div>
			<section id={SECTION_IDS.features} className='min-h-svh border-t' />
			<section id={SECTION_IDS.faq} className='min-h-svh border-t' />
			<section id={SECTION_IDS.download} className='min-h-svh border-t' />
		</main>
	);
}
