import { describe, expect, test } from 'bun:test';
import { signInLandingUrl } from './sign-in-landing';

describe('signInLandingUrl', () => {
	test('points at the landing page for the outcome, in the app language', () => {
		expect(signInLandingUrl('es', true)).toBe('https://tempi.sebastianurdanegui.com/es/signed-in');
		expect(signInLandingUrl('en', false)).toBe('https://tempi.sebastianurdanegui.com/en/sign-in-failed');
	});
});
