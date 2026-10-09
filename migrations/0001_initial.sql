CREATE TABLE profile (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	birthday TEXT,
	timezone TEXT NOT NULL,
	preferences_json TEXT NOT NULL,
	guidance_json TEXT NOT NULL,
	version INTEGER NOT NULL CHECK (version >= 1),
	last_mutation_id TEXT NOT NULL,
	last_mutation_hash TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE measurements (
	id TEXT PRIMARY KEY,
	kind TEXT NOT NULL CHECK (kind IN ('height', 'weight')),
	effective_date TEXT NOT NULL,
	value REAL NOT NULL CHECK (value > 0),
	version INTEGER NOT NULL CHECK (version >= 1),
	last_mutation_id TEXT NOT NULL,
	last_mutation_hash TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	UNIQUE (kind, effective_date)
);

CREATE TABLE plan_revisions (
	revision INTEGER PRIMARY KEY AUTOINCREMENT,
	request_id TEXT NOT NULL UNIQUE,
	review_month TEXT NOT NULL,
	accepted_at TEXT NOT NULL,
	algorithm_version TEXT NOT NULL,
	catalog_version TEXT NOT NULL,
	input_json TEXT NOT NULL,
	template_json TEXT NOT NULL,
	rationale_json TEXT NOT NULL,
	content_hash TEXT NOT NULL
);

CREATE TABLE sessions (
	id TEXT PRIMARY KEY,
	source_plan_revision INTEGER REFERENCES plan_revisions (revision),
	local_date TEXT NOT NULL,
	timezone TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'completed', 'abandoned')),
	target_json TEXT NOT NULL,
	actual_json TEXT,
	version INTEGER NOT NULL CHECK (version >= 1),
	last_mutation_id TEXT NOT NULL,
	last_mutation_hash TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);



CREATE INDEX idx_measurements_kind_date ON measurements (kind, effective_date);
CREATE INDEX idx_sessions_local_date ON sessions (local_date);
CREATE INDEX idx_plan_revisions_month ON plan_revisions (review_month);
