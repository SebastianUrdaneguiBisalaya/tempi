import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';
import { hasLocale } from '@/lib/i18n';
import { loadDictionary } from './dictionaries';

export const alt = 'Tempi';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const dataUrl = async (file: string) => `data:image/png;base64,${(await readFile(join(process.cwd(), 'public', file))).toString('base64')}`;

export default async function OpenGraphImage({ params }: { params: Promise<{ lang: string }> }) {
	const { lang } = await params;
	if (!hasLocale(lang)) notFound();
	const [{ hero, meta }, background, icon] = await Promise.all([loadDictionary(lang), dataUrl('bg-tempi.png'), dataUrl('tempi-icon.png')]);

	return new ImageResponse(
		<div style={{ position: 'relative', display: 'flex', width: '100%', height: '100%', background: '#0a0a0a', color: '#fafafa' }}>
			{/* biome-ignore lint/performance/noImgElement: ImageResponse renders plain <img>, not next/image. */}
			<img src={background} alt='' width={1200} height={630} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }} />
			<div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, width: '100%' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 36, fontWeight: 600 }}>
					{/* biome-ignore lint/performance/noImgElement: ImageResponse renders plain <img>, not next/image. */}
					<img src={icon} alt='' width={96} height={96} style={{ margin: '-24px -8px -24px -28px' }} />
					Tempi
				</div>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
					<div style={{ display: 'flex', flexDirection: 'column', fontSize: 60, lineHeight: 1.1, letterSpacing: -2 }}>
						{hero.titleLines.map((line, index) => (
							<span key={line} style={{ color: index === 0 ? '#fafafa' : 'rgba(250,250,250,0.5)' }}>
								{line}
							</span>
						))}
					</div>
					<div style={{ fontSize: 28, color: 'rgba(250,250,250,0.7)', maxWidth: 900 }}>{meta.description}</div>
				</div>
			</div>
		</div>,
		size
	);
}
