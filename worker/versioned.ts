import { ApiError } from "../src/domain/contracts";
import {
	decideVersionedWrite,
	type VersionedCurrent,
	type VersionedDecision,
} from "../src/domain/saves";
import type { VersionedRow } from "./db";

export function asCurrent(row: VersionedRow | null): VersionedCurrent | null {
	if (!row) {
		return null;
	}
	return {
		version: row.version,
		lastMutationId: row.last_mutation_id,
		lastMutationHash: row.last_mutation_hash,
	};
}

export function assertConcurrentRetry(
	row: VersionedRow | null,
	mutationId: string,
	contentHash: string,
): void {
	if (row?.last_mutation_id === mutationId && row.last_mutation_hash === contentHash) return;
	throw new ApiError(409, "conflict", "Record changed during the save; reload before retrying", {
		currentVersion: row?.version ?? 0,
	});
}

export function decideOrThrow(args: {
	current: VersionedCurrent | null;
	expectedVersion: number;
	mutationId: string;
	contentHash: string;
}): Extract<VersionedDecision, { action: "insert" | "update" | "idempotent" }> {
	const decision = decideVersionedWrite(args);
	if (decision.action === "conflict") {
		throw new ApiError(
			409,
			"conflict",
			decision.reason === "mutation_reuse"
				? "Mutation id was reused with different content"
				: "Stored version does not match expectedVersion",
			{ currentVersion: decision.currentVersion },
		);
	}
	return decision;
}
