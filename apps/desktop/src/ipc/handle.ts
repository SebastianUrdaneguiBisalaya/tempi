import { fail, ok, parseWith, type Result } from '@tempi/core';
import { type Channel, type ChannelPayload, type ChannelValue, payloadSchemas } from '@tempi/ipc';

/** The part of an invoke event a handler needs. Electron's `IpcMainInvokeEvent` satisfies it. */
export type IpcSender = { senderFrame: { url: string } | null };

/** The part of `ipcMain` handlers use, so tests can register against a fake. */
export type IpcRegistrar = {
	handle(channel: string, listener: (event: IpcSender, payload: unknown) => Promise<unknown>): void;
};

export type HandlerContext = {
	ipc: IpcRegistrar;
	/** True only for the app's own origin (app://tempi or the dev server). */
	isTrusted: (url: string) => boolean;
};

/**
 * Registers one channel: rejects untrusted senders, validates the payload with its core schema,
 * and turns every outcome, including thrown storage errors, into a `Result` so nothing raw crosses IPC.
 */
export const handle = <C extends Channel>(context: HandlerContext, channel: C, run: (payload: ChannelPayload<C>) => Promise<ChannelValue<C>>): void => {
	context.ipc.handle(channel, async (event, payload): Promise<Result<ChannelValue<C>>> => {
		const url = event.senderFrame?.url ?? '';
		if (!context.isTrusted(url)) return fail('internal', 'system.unexpected', { detail: `Refused ${channel} from untrusted sender "${url}"` });

		const parsed = parseWith(payloadSchemas[channel], payload);
		if (!parsed.ok) return parsed;

		try {
			// TS loses the channel → schema correlation through the generic index; the schema was picked by the same `channel`.
			return ok(await run(parsed.value as ChannelPayload<C>));
		} catch (error) {
			console.error(`IPC ${channel} failed`, error);
			return fail('internal', 'system.unexpected', { detail: `${channel} failed: ${error instanceof Error ? error.message : String(error)}` });
		}
	});
};
