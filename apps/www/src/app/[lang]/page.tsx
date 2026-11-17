import { getDictionary } from './dictionaries';

export default async function LandingPage() {
	const { meta } = await getDictionary();
	// Placeholder until the landing sections land; the hero replaces it.
	return (
		<main className='flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center'>
			<h1 className='font-heading text-3xl'>{meta.title}</h1>
			<p className='text-muted-foreground'>{meta.description}</p>
		</main>
	);
}
