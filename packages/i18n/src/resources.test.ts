import { describe, expect, test } from 'bun:test';
import { ERROR_KEYS, LANGUAGES } from '@tempi/core';
import { issueTranslation, resources } from './index';

const leafPaths = (tree: object, prefix = ''): string[] =>
	Object.entries(tree).flatMap(([key, value]) => (typeof value === 'string' ? [`${prefix}${key}`] : leafPaths(value as object, `${prefix}${key}.`)));

const lookup = (tree: object, path: string): unknown => path.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], tree);

const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]).sort();

describe('resources', () => {
	test('has every language core supports', () => {
		expect(Object.keys(resources).sort()).toEqual([...LANGUAGES].sort());
	});

	test.each([...LANGUAGES])('%s translates every core error key with a non-empty string', language => {
		for (const key of Object.keys(ERROR_KEYS)) {
			const text = lookup(resources[language].errors, key);
			expect(typeof text === 'string' && text.trim() !== '', `${language}: errors.${key}`).toBe(true);
		}
	});

	test('every locale has the same keys and placeholders as English', () => {
		const english = leafPaths(resources.en);
		for (const language of LANGUAGES) {
			expect(leafPaths(resources[language])).toEqual(english);
			for (const path of english) {
				expect(placeholders(String(lookup(resources[language], path))), `${language}: ${path}`).toEqual(placeholders(String(lookup(resources.en, path))));
			}
		}
	});
});

describe('issueTranslation', () => {
	test('targets the errors namespace and passes the params', () => {
		expect(issueTranslation({ key: 'validation.max', params: { maximum: 1440 } })).toEqual({ key: 'validation.max', options: { maximum: 1440, ns: 'errors' } });
	});
});
