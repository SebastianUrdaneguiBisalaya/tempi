import { Ai } from '@/features/ai/components/ai';
import { Download } from '@/features/download/components/download';
import { Faq } from '@/features/faq/components/faq';
import { Features } from '@/features/features/components/features';
import { SiteFooter } from '@/features/footer/components/site-footer';
import { Hero } from '@/features/hero/components/hero';
import { Integrations } from '@/features/integrations/components/integrations';
import { Keyboard } from '@/features/keyboard/components/keyboard';
import { Planning } from '@/features/planning/components/planning';
import { WhyTempi } from '@/features/why/components/why-tempi';

export default function LandingPage() {
	return (
		<>
			<main className='flex flex-1 flex-col'>
				<Hero />
				<WhyTempi />
				<Features />
				<Planning />
				<Integrations />
				<Ai />
				<Keyboard />
				<Faq />
				<Download />
			</main>
			<SiteFooter />
		</>
	);
}
