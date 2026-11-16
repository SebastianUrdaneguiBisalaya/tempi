import { useState } from 'react';

/** Tracks an element's content height with a `ResizeObserver`: pass `ref` to the element, read `height` (0 until measured). */
export const useElementHeight = () => {
	const [height, setHeight] = useState(0);
	const ref = (node: HTMLElement | null) => {
		if (node === null) return;
		const observer = new ResizeObserver(([entry]) => setHeight(entry?.contentRect.height ?? 0));
		observer.observe(node);
		return () => observer.disconnect();
	};
	return { height, ref };
};
