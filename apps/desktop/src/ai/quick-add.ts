import type { parseQuickAdd, textModel } from '@tempi/ai';
import { fail, type QuickAddContext, type QuickAddProposal, type quickAddInputSchema, type Result } from '@tempi/core';
import type { z } from 'zod';
import type { AiKeyStore } from './key-store';
import type { AiSettingsStore } from './settings-store';

export type QuickAddDeps = {
	keys: AiKeyStore;
	settings: AiSettingsStore;
	context: () => Promise<QuickAddContext>;
	model: typeof textModel;
	parse: typeof parseQuickAdd;
};

/** Reads quick add text with the provider chosen in Settings. The key is read here and never leaves the main process. */
export type QuickAdd = (input: z.output<typeof quickAddInputSchema>) => Promise<Result<QuickAddProposal>>;

export const createQuickAdd =
	(deps: QuickAddDeps): QuickAdd =>
	async ({ text }) => {
		// The saved settings decide, not the renderer, so nothing reaches a provider the user didn't pick for quick add.
		const { models, quickAdd } = await deps.settings.read();
		if (quickAdd.mode !== 'ai' || quickAdd.provider === null) return fail('validation', 'ai.invalidKey', { detail: 'Quick add is set to read text on this device' });
		const { provider } = quickAdd;
		const key = await deps.keys.get(provider);
		if (key === null) return fail('not_found', 'ai.invalidKey', { detail: `No key is saved for ${provider}` });
		return deps.parse({ context: await deps.context(), model: deps.model(provider, key, models), provider, text });
	};
