/**
 * The text of a reply without its Markdown, for ElevenLabs to read. Voice replies are asked for plain sentences, but a
 * model may still slip a `# Title` or `**bold**` in, and the voice would read the symbols aloud.
 */
export const spokenText = (text: string): string =>
	text
		.split('\n')
		// Table rules (`|---|:--:|`) and horizontal rules carry no words.
		.filter(line => !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line) && !/^\s*([-*_])(\s*\1){2,}\s*$/.test(line))
		.map(line =>
			line
				// Headings, quotes and list markers at the start of a line.
				.replace(/^\s*#{1,6}\s+/, '')
				.replace(/^\s*>\s?/, '')
				.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
				// Table cells read as a list.
				.replace(/^\s*\|(.*)\|\s*$/, '$1')
				.replace(/\s*\|\s*/g, ', ')
				// Links and images keep their text; emphasis, strikethrough and code keep their content.
				.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
				.replace(/(\*\*|__)(.+?)\1/g, '$2')
				.replace(/(\*|_)(\S(?:.*?\S)?)\1/g, '$2')
				.replace(/~~(.+?)~~/g, '$1')
				.replace(/`+([^`]*)`+/g, '$1')
				.trim()
		)
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
