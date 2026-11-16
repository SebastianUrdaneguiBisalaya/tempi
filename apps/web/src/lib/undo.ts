// The one action that can be undone right now (the last delete). Its toast's Undo button and ⌘Z both run it;
// it is withdrawn when that toast closes, so ⌘Z never undoes something the user can no longer see.

type PendingUndo = { id: number; run: () => void };

let pending: PendingUndo | null = null;
let lastId = 0;

/** Makes `run` the current undo, replacing any earlier one. Returns an id to withdraw it with. */
export const offerUndo = (run: () => void): number => {
	lastId += 1;
	pending = { id: lastId, run };
	return lastId;
};

/** Drops the undo with this id, if it is still the current one. */
export const withdrawUndo = (id: number): void => {
	if (pending?.id === id) pending = null;
};

/** Runs the current undo once. Returns false when there was nothing to undo. */
export const runUndo = (): boolean => {
	const current = pending;
	pending = null;
	current?.run();
	return current !== null;
};
