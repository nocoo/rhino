export type VersionedCurrent = {
	version: number;
	lastMutationId: string;
	lastMutationHash: string;
};

export type VersionedDecision =
	| { action: "insert" }
	| { action: "update"; nextVersion: number }
	| { action: "idempotent" }
	| {
			action: "conflict";
			reason: "stale_version" | "mutation_reuse";
			currentVersion: number;
	  };

export type PlanAcceptDecision =
	| { action: "insert" }
	| { action: "idempotent" }
	| {
			action: "conflict";
			reason: "stale_revision" | "request_reuse";
			currentRevision: number;
	  };

export function decideVersionedWrite(args: {
	current: VersionedCurrent | null;
	expectedVersion: number;
	mutationId: string;
	contentHash: string;
}): VersionedDecision {
	if (!args.current) {
		if (args.expectedVersion !== 0) {
			return { action: "conflict", reason: "stale_version", currentVersion: 0 };
		}
		return { action: "insert" };
	}
	if (args.mutationId === args.current.lastMutationId) {
		if (args.contentHash === args.current.lastMutationHash) {
			return { action: "idempotent" };
		}
		return {
			action: "conflict",
			reason: "mutation_reuse",
			currentVersion: args.current.version,
		};
	}
	if (args.expectedVersion !== args.current.version) {
		return {
			action: "conflict",
			reason: "stale_version",
			currentVersion: args.current.version,
		};
	}
	return { action: "update", nextVersion: args.current.version + 1 };
}

export function decidePlanAccept(args: {
	currentRevision: number;
	expectedRevision: number;
	existingRequest: { requestId: string; contentHash: string } | null;
	requestId: string;
	contentHash: string;
}): PlanAcceptDecision {
	if (args.existingRequest) {
		if (args.existingRequest.contentHash === args.contentHash) {
			return { action: "idempotent" };
		}
		return {
			action: "conflict",
			reason: "request_reuse",
			currentRevision: args.currentRevision,
		};
	}
	if (args.expectedRevision !== args.currentRevision) {
		return {
			action: "conflict",
			reason: "stale_revision",
			currentRevision: args.currentRevision,
		};
	}
	return { action: "insert" };
}
