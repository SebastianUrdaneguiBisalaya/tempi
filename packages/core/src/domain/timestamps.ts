/** Sync-ready bookkeeping shared by every stored entity. All values are UTC ISO-8601. */
export type Timestamps = {
	createdAt: string;
	deletedAt: string | null;
	updatedAt: string;
};
