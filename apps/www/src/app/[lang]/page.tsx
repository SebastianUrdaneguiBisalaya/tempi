import { Features } from '@/features/features/components/features';
import { Hero } from '@/features/hero/components/hero';
import { WhyTempi } from '@/features/why/components/why-tempi';
import { SECTION_IDS } from '@/lib/site';

export default function LandingPage() {
	// Empty sections are placeholders until each section issue replaces its own.
	return (
		<main className='flex flex-1 flex-col'>
			<Hero />
			<WhyTempi />
			<Features />
			<section id={SECTION_IDS.faq} className='min-h-svh border-t' />
			<section id={SECTION_IDS.download} className='min-h-svh border-t' />
		</main>
	);
}
