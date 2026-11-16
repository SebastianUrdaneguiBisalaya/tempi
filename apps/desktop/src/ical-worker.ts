// Entry of the iCalendar utility process (bundled to dist/ical-worker.js). Parsing and writing large files is CPU
// work that would block the main process, which also serves every IPC call; here it runs on its own.
import { parseIcs, serializeIcs } from '@tempi/ical';
import { type IcalWorkerResponse, icalWorkerRequestSchema } from './ical-worker-protocol.js';

const respond = (request: unknown): IcalWorkerResponse => {
	const parsed = icalWorkerRequestSchema.safeParse(request);
	if (!parsed.success) return { detail: `Malformed request: ${parsed.error.message}`, kind: 'failed' };
	const message = parsed.data;
	if (message.kind === 'parse') return { kind: 'parsed', result: parseIcs(message.text, message.options) };
	return { kind: 'serialized', text: serializeIcs(message.data, new Date(message.now)) };
};

process.parentPort.on('message', ({ data }) => {
	let response: IcalWorkerResponse;
	try {
		response = respond(data);
	} catch (error) {
		response = { detail: error instanceof Error ? error.message : String(error), kind: 'failed' };
	}
	process.parentPort.postMessage(response);
});
