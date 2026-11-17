import { getDictionary } from '@/app/[lang]/dictionaries';
import { SiteFooter } from '@/features/footer/components/site-footer';
import { DownloadContent } from './download-content';

export async function Download() {
	const { download } = await getDictionary();
	return <DownloadContent copy={download} footer={<SiteFooter />} />;
}
