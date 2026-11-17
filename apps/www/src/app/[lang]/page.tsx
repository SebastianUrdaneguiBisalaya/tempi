import { Faq } from '@/features/faq/components/faq';
import { Features } from '@/features/features/components/features';
import { Hero } from '@/features/hero/components/hero';
import { Keyboard } from '@/features/keyboard/components/keyboard';
import { WhyTempi } from '@/features/why/components/why-tempi';
import { SECTION_IDS } from '@/lib/site';

export default function LandingPage() {
	// Empty sections are placeholders until each section issue replaces its own.
	return (
		<main className='flex flex-1 flex-col'>
			<Hero />
			<WhyTempi />
			<Features />
			<Keyboard />
			<Faq />
			<section id={SECTION_IDS.download} className='min-h-svh border-t' />
		</main>
	);
}
