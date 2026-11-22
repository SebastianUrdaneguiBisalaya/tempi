import { describe, expect, test } from 'bun:test';
import { oauthClientFrom } from './oauth';

const id = 'client-id.apps.googleusercontent.com';
const secret = 'client-secret';

describe('client config', () => {
	test('needs both the id and the secret', () => {
		expect(oauthClientFrom({ id, secret })).toEqual({ clientId: id, clientSecret: secret });
		expect(oauthClientFrom({ id, secret: undefined })).toBeNull();
		expect(oauthClientFrom({ id: ' ', secret })).toBeNull();
	});
});
