/**
 * Waits until the faces of `font` (a CSS font shorthand) have loaded or failed, and never rejects. next/font adds a
 * metric-matched fallback face with `src: local(Arial)`; where Arial isn't installed (Android), that face fails and
 * `FontFaceSet.load` rejects even though the web font itself is ready. Drawing then goes ahead with whatever loaded.
 */
export async function loadFont(fonts: Pick<FontFaceSet, 'load'>, font: string): Promise<void> {
	try {
		await fonts.load(font);
	} catch {
		// A missing local fallback face; the canvas still draws with the faces that are available.
	}
}
