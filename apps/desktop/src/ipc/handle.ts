import { fail, parseWith, type Result } from '@tempi/core';
import type { TransactionQueue } from '@tempi/db';
import { type Channel, type ChannelPayload, type ChannelValue, payloadSchemas } from '@tempi/ipc';

/** The part of an invoke event a handler needs. Electron's `IpcMainInvokeEvent` satisfies it. */
export type IpcSender = { senderFrame: { url: string } | null };

/** The part of `ipcMain` handlers use, so tests can register against a fake. */
export type IpcRegistrar = {
	handle(channel: string, listener: (event: IpcSender, payload: unknown) => Promise<unknown>): void;
};

/**
 * Work outside the database that must follow the transaction's outcome: `afterCommit` runs only once the writes are
 * committed (e.g. deleting a file nothing references any more), `afterRollback` only when they are undone (e.g. deleting
 * a file written for them).
 */
export type CommitHooks = { afterCommit: (effect: () => Promise<void>) => void; afterRollback: (effect: () => Promise<void>) => void };

/** Runs follow-up effects in order. Their failures are logged, never returned: the call's outcome is already decided. */
const runEffects = async (channel: string, effects: (() => Promise<void>)[]): Promise<void> => {
	for (const effect of effects) {
		await effect().catch((error: unknown) => console.error(`IPC ${channel}: a follow-up step failed`, error));
	}
};

export type HandlerContext = {
	ipc: IpcRegistrar;
	/** True only for the app's own origin (app://tempi or the dev server). */
	isTrusted: (url: string) => boolean;
	/** Runs each call as one serialized SQLite transaction. */
	transaction: TransactionQueue;
};

/**
 * Registers one channel's checks around `respond`: rejects untrusted senders, validates the payload with its core
 * schema, and turns a thrown error into a failed `Result`, so nothing raw crosses IPC. `respond` decides how the work
 * is split around transactions; most channels go through `handle`.
 */
export const handleRequest = <C extends Channel>(context: HandlerContext, channel: C, respond: (payload: ChannelPayload<C>) => Promise<Result<ChannelValue<C>>>): void => {
	context.ipc.handle(channel, async (event, payload): Promise<Result<ChannelValue<C>>> => {
		const url = event.senderFrame?.url ?? '';
		if (!context.isTrusted(url)) return fail('internal', 'system.unexpected', { detail: `Refused ${channel} from untrusted sender "${url}"` });

		const parsed = parseWith(payloadSchemas[channel], payload);
		if (!parsed.ok) return parsed;
		try {
			// TS loses the channel → schema correlation through the generic index; the schema was picked by the same `channel`.
			return await respond(parsed.value as ChannelPayload<C>);
		} catch (error) {
			console.error(`IPC ${channel} failed`, error);
			return fail('internal', 'system.unexpected', { detail: `${channel} failed: ${error instanceof Error ? error.message : String(error)}` });
		}
	});
};

/**
 * Registers one channel that runs its use case as one transaction (a failed Result or a thrown error rolls back every
 * write). Effects queued through the `CommitHooks` run after the commit or the rollback they wait for.
 */
export const handle = <C extends Channel>(
	context: HandlerContext,
	channel: C,
	run: (payload: ChannelPayload<C>, hooks: CommitHooks) => Promise<Result<ChannelValue<C>>>,
	/** Runs after the transaction commits, so main-process side effects never reflect rolled-back writes. */
	onCommitted?: (value: ChannelValue<C>) => void
): void => {
	handleRequest(context, channel, async input => {
		const committed: (() => Promise<void>)[] = [];
		const rolledBack: (() => Promise<void>)[] = [];
		const hooks: CommitHooks = { afterCommit: effect => committed.push(effect), afterRollback: effect => rolledBack.push(effect) };
		try {
			const result = await context.transaction(() => run(input, hooks));
			if (!result.ok) {
				await runEffects(channel, rolledBack);
				return result;
			}
			onCommitted?.(result.value);
			await runEffects(channel, committed);
			return result;
		} catch (error) {
			await runEffects(channel, rolledBack);
			throw error;
		}
	});
};
