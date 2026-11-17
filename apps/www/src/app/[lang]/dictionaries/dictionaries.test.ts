import { describe, expect, test } from 'bun:test';
import en from './en.json';
import es from './es.json';

function leaves(value: unknown, path = ''): Map<string, string> {
	const result = new Map<string, string>();
	if (typeof value === 'string') {
		result.set(path, value);
		return result;
	}
	if (typeof value === 'object' && value !== null) {
		for (const [key, child] of Object.entries(value)) {
			for (const [childPath, text] of leaves(child, path ? `${path}.${key}` : key)) result.set(childPath, text);
		}
	}
	return result;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

describe('www dictionaries', () => {
	const english = leaves(en);
	const spanish = leaves(es);

	test('es has exactly the keys of en', () => {
		expect([...spanish.keys()].sort()).toEqual([...english.keys()].sort());
	});

	test('es keeps the placeholders of en', () => {
		for (const [key, text] of english) expect({ key, placeholders: placeholders(spanish.get(key) ?? '') }).toEqual({ key, placeholders: placeholders(text) });
	});

	test('no translation is empty', () => {
		for (const [key, text] of [...english, ...spanish]) expect({ key, empty: text.trim() === '' }).toEqual({ key, empty: false });
	});
});
