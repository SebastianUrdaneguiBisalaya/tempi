import { getDictionary } from '@/app/[lang]/dictionaries';
import { WordmarkBand } from './wordmark-band';

export async function Wordmark() {
	const { wordmark } = await getDictionary();
	return (
		<section>
			<WordmarkBand label={wordmark.label} />
		</section>
	);
}
