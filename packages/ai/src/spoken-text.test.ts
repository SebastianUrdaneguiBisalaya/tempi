import { describe, expect, test } from 'bun:test';
import { spokenText } from './spoken-text';

describe('spokenText', () => {
	test('drops heading, list and emphasis symbols so the voice never reads them aloud', () => {
		expect(spokenText('# Tu día\n\n- **10:00** · Dentista\n- 12:00 · _Almuerzo_ con `Alex`\n1. Llamar a ~~Ana~~ Eva')).toBe(
			'Tu día\n\n10:00 · Dentista\n12:00 · Almuerzo con Alex\nLlamar a Ana Eva'
		);
	});

	test('reads a table as lines of cells and skips its rule', () => {
		expect(spokenText('| Hora | Evento |\n|------|:------:|\n| 10:00 | Dentista |')).toBe('Hora, Evento\n10:00, Dentista');
	});

	test('keeps link text, drops the URL and quote marks, and leaves plain sentences alone', () => {
		expect(spokenText('> Mira [la agenda](https://example.com).\n---\nMañana tienes dentista a las 3.')).toBe('Mira la agenda.\nMañana tienes dentista a las 3.');
		expect(spokenText('Son las 3 y 5 * 2 = 10.')).toBe('Son las 3 y 5 * 2 = 10.');
	});
});
