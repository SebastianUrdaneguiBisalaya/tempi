import { describe, expect, test } from 'bun:test';
import { oauthClientFrom } from './oauth';

const client = { id: 'client-id.apps.googleusercontent.com', secret: 'client-secret' };

describe('client config', () => {
	test('needs both the id and the secret', () => {
		expect(oauthClientFrom({ id: client.id, secret: client.secret })).toEqual(client);
		expect(oauthClientFrom({ id: client.id, secret: undefined })).toBeNull();
		expect(oauthClientFrom({ id: ' ', secret: client.secret })).toBeNull();
	});
});
