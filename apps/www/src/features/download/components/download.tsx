import { getDictionary } from '@/app/[lang]/dictionaries';
import { DownloadContent } from './download-content';

export async function Download() {
	const { download } = await getDictionary();
	return <DownloadContent copy={download} />;
}
