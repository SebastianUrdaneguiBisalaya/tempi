import { utilityProcess } from 'electron';
import { type IcalWorkerRequest, type IcalWorkerResponse, icalWorkerResponseSchema } from './ical-worker-protocol.js';

// Generous: a calendar with many years of history parses in seconds; anything slower is stuck.
const TIMEOUT_MS = 2 * 60_000;

/**
 * Runs one request in a fresh iCalendar utility process and ends it after the answer. Import and export are rare, so a
 * process per request costs little and never leaves one idling.
 */
export const createIcalWorker =
	(workerPath: string) =>
	(request: IcalWorkerRequest): Promise<IcalWorkerResponse> =>
		new Promise((resolve, reject) => {
			const child = utilityProcess.fork(workerPath, [], { serviceName: 'Tempi iCalendar' });
			let settled = false;
			const settle = (outcome: () => void) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				child.kill();
				outcome();
			};
			const timer = setTimeout(() => settle(() => reject(new Error('The iCalendar process timed out'))), TIMEOUT_MS);
			child.once('message', (message: unknown) => {
				const parsed = icalWorkerResponseSchema.safeParse(message);
				settle(() => (parsed.success ? resolve(parsed.data) : reject(new Error('The iCalendar process sent a malformed answer'))));
			});
			child.once('exit', code => settle(() => reject(new Error(`The iCalendar process exited with code ${code}`))));
			child.postMessage(request);
		});
