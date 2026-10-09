import {
	type MeasurementKind,
	type MeasurementRecord,
	measurementRecordSchema,
	type PlanInput,
	type PlanRationale,
	type PlanRevisionRecord,
	PROFILE_ID,
	type ProfileRecord,
	parseWithSchema,
	planRevisionRecordSchema,
	profileRecordSchema,
	type SessionActual,
	type SessionRecord,
	type SessionStatus,
	type SessionTarget,
	sessionRecordSchema,
	type WeeklyTemplate,
} from "../src/domain/contracts";

export type VersionedRow = {
	version: number;
	last_mutation_id: string;
	last_mutation_hash: string;
};

type ProfileRow = VersionedRow & {
	id: number;
	birthday: string | null;
	timezone: string;
	preferences_json: string;
	guidance_json: string;
	created_at: string;
	updated_at: string;
};

type MeasurementRow = VersionedRow & {
	id: string;
	kind: MeasurementKind;
	effective_date: string;
	value: number;
	created_at: string;
	updated_at: string;
};

type PlanRow = {
	revision: number;
	request_id: string;
	review_month: string;
	accepted_at: string;
	algorithm_version: string;
	catalog_version: string;
	input_json: string;
	template_json: string;
	rationale_json: string;
	content_hash: string;
};

type SessionRow = VersionedRow & {
	id: string;
	source_plan_revision: number | null;
	local_date: string;
	timezone: string;
	status: SessionStatus;
	target_json: string;
	actual_json: string | null;
	created_at: string;
	updated_at: string;
};

export async function getProfile(db: D1Database): Promise<ProfileRecord | null> {
	const row = await db
		.prepare("SELECT * FROM profile WHERE id = ?")
		.bind(PROFILE_ID)
		.first<ProfileRow>();
	return row ? mapProfile(row) : null;
}

export async function getProfileVersioned(db: D1Database): Promise<VersionedRow | null> {
	return db
		.prepare("SELECT version, last_mutation_id, last_mutation_hash FROM profile WHERE id = ?")
		.bind(PROFILE_ID)
		.first<VersionedRow>();
}

export async function insertProfile(
	db: D1Database,
	record: ProfileRecord,
	contentHash: string,
): Promise<boolean> {
	const result = await db
		.prepare(
			`INSERT INTO profile (
				id, birthday, timezone, preferences_json, guidance_json, version,
				last_mutation_id, last_mutation_hash, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
		)
		.bind(
			PROFILE_ID,
			record.birthday,
			record.timezone,
			JSON.stringify(record.preferences),
			JSON.stringify(record.guidance),
			record.version,
			record.lastMutationId,
			contentHash,
			record.createdAt,
			record.updatedAt,
		)
		.run();
	return (result.meta.changes ?? 0) > 0;
}

export async function updateProfile(
	db: D1Database,
	record: ProfileRecord,
	expectedVersion: number,
	contentHash: string,
): Promise<boolean> {
	const result = await db
		.prepare(
			`UPDATE profile SET
				birthday = ?, timezone = ?, preferences_json = ?, guidance_json = ?,
				version = ?, last_mutation_id = ?, last_mutation_hash = ?, updated_at = ?
			WHERE id = ? AND version = ?`,
		)
		.bind(
			record.birthday,
			record.timezone,
			JSON.stringify(record.preferences),
			JSON.stringify(record.guidance),
			record.version,
			record.lastMutationId,
			contentHash,
			record.updatedAt,
			PROFILE_ID,
			expectedVersion,
		)
		.run();
	return (result.meta.changes ?? 0) > 0;
}

export async function listMeasurements(
	db: D1Database,
	from: string,
	to: string,
): Promise<MeasurementRecord[]> {
	const result = await db
		.prepare(
			"SELECT * FROM measurements WHERE effective_date >= ? AND effective_date <= ? ORDER BY effective_date ASC, kind ASC",
		)
		.bind(from, to)
		.all<MeasurementRow>();
	return result.results.map(mapMeasurement);
}

export async function listAllMeasurements(db: D1Database): Promise<MeasurementRecord[]> {
	const result = await db
		.prepare("SELECT * FROM measurements ORDER BY effective_date ASC, kind ASC")
		.all<MeasurementRow>();
	return result.results.map(mapMeasurement);
}

export async function getMeasurement(
	db: D1Database,
	id: string,
): Promise<MeasurementRecord | null> {
	const row = await db
		.prepare("SELECT * FROM measurements WHERE id = ?")
		.bind(id)
		.first<MeasurementRow>();
	return row ? mapMeasurement(row) : null;
}

export async function getMeasurementVersioned(
	db: D1Database,
	id: string,
): Promise<VersionedRow | null> {
	return db
		.prepare("SELECT version, last_mutation_id, last_mutation_hash FROM measurements WHERE id = ?")
		.bind(id)
		.first<VersionedRow>();
}

export async function getMeasurementByKindDate(
	db: D1Database,
	kind: MeasurementKind,
	effectiveDate: string,
): Promise<MeasurementRecord | null> {
	const row = await db
		.prepare("SELECT * FROM measurements WHERE kind = ? AND effective_date = ?")
		.bind(kind, effectiveDate)
		.first<MeasurementRow>();
	return row ? mapMeasurement(row) : null;
}

export async function insertMeasurement(
	db: D1Database,
	record: MeasurementRecord,
	contentHash: string,
): Promise<boolean> {
	const result = await db
		.prepare(
			`INSERT INTO measurements (
				id, kind, effective_date, value, version, last_mutation_id, last_mutation_hash, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
		)
		.bind(
			record.id,
			record.kind,
			record.effectiveDate,
			record.value,
			record.version,
			record.lastMutationId,
			contentHash,
			record.createdAt,
			record.updatedAt,
		)
		.run();
	return (result.meta.changes ?? 0) > 0;
}

export async function updateMeasurement(
	db: D1Database,
	record: MeasurementRecord,
	expectedVersion: number,
	contentHash: string,
): Promise<boolean> {
	const result = await db
		.prepare(
			`UPDATE OR IGNORE measurements SET
				kind = ?, effective_date = ?, value = ?, version = ?, last_mutation_id = ?,
				last_mutation_hash = ?, updated_at = ?
			WHERE id = ? AND version = ?`,
		)
		.bind(
			record.kind,
			record.effectiveDate,
			record.value,
			record.version,
			record.lastMutationId,
			contentHash,
			record.updatedAt,
			record.id,
			expectedVersion,
		)
		.run();
	return (result.meta.changes ?? 0) > 0;
}

export async function deleteMeasurement(
	db: D1Database,
	id: string,
	expectedVersion: number,
): Promise<boolean> {
	const result = await db
		.prepare("DELETE FROM measurements WHERE id = ? AND version = ?")
		.bind(id, expectedVersion)
		.run();
	return (result.meta.changes ?? 0) > 0;
}

export async function latestPlanRevision(db: D1Database): Promise<number> {
	const row = await db.prepare("SELECT MAX(revision) AS revision FROM plan_revisions").first<{
		revision: number | null;
	}>();
	return row?.revision ?? 0;
}

export async function listPlanRevisions(db: D1Database, limit = 24): Promise<PlanRevisionRecord[]> {
	const result = await db
		.prepare("SELECT * FROM plan_revisions ORDER BY revision DESC LIMIT ?")
		.bind(limit)
		.all<PlanRow>();
	return result.results.map(mapPlan);
}

export async function planRevisionExists(db: D1Database, revision: number): Promise<boolean> {
	return (
		(await db
			.prepare("SELECT revision FROM plan_revisions WHERE revision = ?")
			.bind(revision)
			.first()) !== null
	);
}

export async function getPlanByRequestId(
	db: D1Database,
	requestId: string,
): Promise<(PlanRevisionRecord & { contentHash: string }) | null> {
	const row = await db
		.prepare("SELECT * FROM plan_revisions WHERE request_id = ?")
		.bind(requestId)
		.first<PlanRow>();
	return row ? { ...mapPlan(row), contentHash: row.content_hash } : null;
}

export async function insertPlanRevision(
	db: D1Database,
	record: Omit<PlanRevisionRecord, "revision">,
	expectedRevision: number,
	contentHash: string,
): Promise<PlanRevisionRecord | null> {
	const result = await db
		.prepare(
			`INSERT INTO plan_revisions (
				request_id, review_month, accepted_at, algorithm_version, catalog_version,
				input_json, template_json, rationale_json, content_hash
			)
			SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
			WHERE (SELECT COALESCE(MAX(revision), 0) FROM plan_revisions) = ?
			ON CONFLICT(request_id) DO NOTHING`,
		)
		.bind(
			record.requestId,
			record.reviewMonth,
			record.acceptedAt,
			record.algorithmVersion,
			record.catalogVersion,
			JSON.stringify(record.input),
			JSON.stringify(record.template),
			JSON.stringify(record.rationale),
			contentHash,
			expectedRevision,
		)
		.run();
	if (!result.meta.changes) {
		return null;
	}
	const stored = await getPlanByRequestId(db, record.requestId);
	return stored;
}

export async function getSession(db: D1Database, id: string): Promise<SessionRecord | null> {
	const row = await db.prepare("SELECT * FROM sessions WHERE id = ?").bind(id).first<SessionRow>();
	return row ? mapSession(row) : null;
}

export async function getSessionVersioned(
	db: D1Database,
	id: string,
): Promise<VersionedRow | null> {
	return db
		.prepare("SELECT version, last_mutation_id, last_mutation_hash FROM sessions WHERE id = ?")
		.bind(id)
		.first<VersionedRow>();
}

export async function listSessions(
	db: D1Database,
	from: string,
	to: string,
): Promise<SessionRecord[]> {
	const result = await db
		.prepare(
			"SELECT * FROM sessions WHERE local_date >= ? AND local_date <= ? ORDER BY local_date ASC",
		)
		.bind(from, to)
		.all<SessionRow>();
	return result.results.map(mapSession);
}

export async function insertSession(
	db: D1Database,
	record: SessionRecord,
	contentHash: string,
): Promise<boolean> {
	const result = await db
		.prepare(
			`INSERT INTO sessions (
				id, source_plan_revision, local_date, timezone, status, target_json, actual_json,
				version, last_mutation_id, last_mutation_hash, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
		)
		.bind(
			record.id,
			record.sourcePlanRevision,
			record.localDate,
			record.timezone,
			record.status,
			JSON.stringify(record.target),
			record.actual ? JSON.stringify(record.actual) : null,
			record.version,
			record.lastMutationId,
			contentHash,
			record.createdAt,
			record.updatedAt,
		)
		.run();
	return (result.meta.changes ?? 0) > 0;
}

export async function updateSession(
	db: D1Database,
	record: SessionRecord,
	expectedVersion: number,
	contentHash: string,
): Promise<boolean> {
	const result = await db
		.prepare(
			`UPDATE sessions SET
				source_plan_revision = ?, local_date = ?, timezone = ?, status = ?, target_json = ?,
				actual_json = ?, version = ?, last_mutation_id = ?, last_mutation_hash = ?, updated_at = ?
			WHERE id = ? AND version = ?`,
		)
		.bind(
			record.sourcePlanRevision,
			record.localDate,
			record.timezone,
			record.status,
			JSON.stringify(record.target),
			record.actual ? JSON.stringify(record.actual) : null,
			record.version,
			record.lastMutationId,
			contentHash,
			record.updatedAt,
			record.id,
			expectedVersion,
		)
		.run();
	return (result.meta.changes ?? 0) > 0;
}

function mapProfile(row: ProfileRow): ProfileRecord {
	return parseWithSchema(profileRecordSchema, {
		id: row.id,
		birthday: row.birthday,
		timezone: row.timezone,
		preferences: JSON.parse(row.preferences_json) as ProfileRecord["preferences"],
		guidance: JSON.parse(row.guidance_json) as ProfileRecord["guidance"],
		version: row.version,
		lastMutationId: row.last_mutation_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	});
}

function mapMeasurement(row: MeasurementRow): MeasurementRecord {
	return parseWithSchema(measurementRecordSchema, {
		id: row.id,
		kind: row.kind,
		effectiveDate: row.effective_date,
		value: row.value,
		version: row.version,
		lastMutationId: row.last_mutation_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	});
}

function mapPlan(row: PlanRow): PlanRevisionRecord {
	return parseWithSchema(planRevisionRecordSchema, {
		revision: row.revision,
		requestId: row.request_id,
		reviewMonth: row.review_month,
		acceptedAt: row.accepted_at,
		algorithmVersion: row.algorithm_version,
		catalogVersion: row.catalog_version,
		input: JSON.parse(row.input_json) as PlanInput,
		template: JSON.parse(row.template_json) as WeeklyTemplate,
		rationale: JSON.parse(row.rationale_json) as PlanRationale,
	});
}

function mapSession(row: SessionRow): SessionRecord {
	return parseWithSchema(sessionRecordSchema, {
		id: row.id,
		sourcePlanRevision: row.source_plan_revision,
		localDate: row.local_date,
		timezone: row.timezone,
		status: row.status,
		target: JSON.parse(row.target_json) as SessionTarget,
		actual: row.actual_json ? (JSON.parse(row.actual_json) as SessionActual) : null,
		version: row.version,
		lastMutationId: row.last_mutation_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	});
}
