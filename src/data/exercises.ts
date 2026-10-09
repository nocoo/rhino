import {
	CATALOG_VERSION,
	type EquipmentId,
	type LoadConvention,
	type ReviewStatus,
	type StrengthExerciseId,
} from "../domain/contracts";

export type MuscleRole = {
	id: string;
	name: string;
	role: "primary" | "secondary";
};

export type ExerciseCues = {
	setup: string;
	execution: string;
	breathing: string;
	mistakes: string;
	stopGuidance: string;
};

export type ExerciseAsset = {
	catalogVersion: typeof CATALOG_VERSION;
	modelPath: string;
	posterPath: string;
	animationName: string;
	reviewStatus: ReviewStatus;
	instructionReady: boolean;
};

export type ExerciseDefinition = {
	id: StrengthExerciseId;
	name: string;
	movementPattern:
		| "squat"
		| "hinge"
		| "horizontal-push"
		| "horizontal-pull"
		| "vertical-pull"
		| "vertical-push";
	equipmentId: EquipmentId;
	loadConvention: LoadConvention;
	unilateral: boolean;
	incrementKg: number;
	restSecondsDefault: number;
	muscles: MuscleRole[];
	asset: ExerciseAsset;
	cues: ExerciseCues;
	accessibleAlternative: {
		kind: "static-sequence";
		posterPath: string;
		summary: string;
	};
};

export type EquipmentDefinition = {
	id: EquipmentId;
	name: string;
};

const STOP =
	"Stop the set and seek urgent medical help as appropriate for the location if chest pain, severe unusual breathlessness, or fainting occurs. Pain or uncertain technique is a reason to stop, not a progression target.";

function asset(id: StrengthExerciseId): ExerciseAsset {
	return {
		catalogVersion: CATALOG_VERSION,
		modelPath: "/models/rhino-anatomy.glb",
		posterPath: `/models/exercises/${id}.png`,
		animationName: id,
		reviewStatus: "draft",
		instructionReady: false,
	};
}

export const EQUIPMENT: EquipmentDefinition[] = [
	{ id: "dumbbell", name: "Dumbbell" },
	{ id: "bench", name: "Bench" },
	{ id: "cable-machine", name: "Seated cable machine" },
	{ id: "lat-pulldown-machine", name: "Lat pulldown machine" },
	{ id: "chest-press-machine", name: "Chest press machine" },
];

export const EXERCISES: ExerciseDefinition[] = [
	{
		id: "goblet-squat",
		name: "Goblet squat",
		movementPattern: "squat",
		equipmentId: "dumbbell",
		loadConvention: "total-external",
		unilateral: false,
		incrementKg: 2,
		restSecondsDefault: 120,
		muscles: [
			{ id: "quadriceps", name: "Quadriceps", role: "primary" },
			{ id: "gluteus-maximus", name: "Gluteus maximus", role: "primary" },
			{ id: "hamstrings", name: "Hamstrings", role: "secondary" },
			{ id: "core", name: "Core", role: "secondary" },
		],
		asset: asset("goblet-squat"),
		cues: {
			setup: "Hold one dumbbell at the chest, feet about shoulder-width, heels planted.",
			execution:
				"Sit the hips down and back through a comfortable depth, then stand by pressing the floor away.",
			breathing: "Breathe in before lowering; breathe out while standing.",
			mistakes: "Heels rising, collapsing knees, or forcing depth to match a model.",
			stopGuidance: STOP,
		},
		accessibleAlternative: {
			kind: "static-sequence",
			posterPath: "/models/exercises/goblet-squat.png",
			summary: "Static setup, bottom, and stand phases for the goblet squat.",
		},
	},
	{
		id: "romanian-deadlift",
		name: "Dumbbell Romanian deadlift",
		movementPattern: "hinge",
		equipmentId: "dumbbell",
		loadConvention: "per-hand",
		unilateral: false,
		incrementKg: 2,
		restSecondsDefault: 120,
		muscles: [
			{ id: "hamstrings", name: "Hamstrings", role: "primary" },
			{ id: "gluteus-maximus", name: "Gluteus maximus", role: "primary" },
			{ id: "erector-spinae", name: "Erector spinae", role: "secondary" },
		],
		asset: asset("romanian-deadlift"),
		cues: {
			setup: "Hold a dumbbell in each hand at the thighs, soft knees, ribs stacked over pelvis.",
			execution:
				"Hinge at the hips until a hamstring stretch, then squeeze the glutes to stand tall.",
			breathing: "Breathe in on the hinge; breathe out while returning to stand.",
			mistakes: "Rounding the back, locking the knees, or turning the movement into a squat.",
			stopGuidance: STOP,
		},
		accessibleAlternative: {
			kind: "static-sequence",
			posterPath: "/models/exercises/romanian-deadlift.png",
			summary: "Static stand, hinge, and lockout phases for the Romanian deadlift.",
		},
	},
	{
		id: "chest-press",
		name: "Machine chest press",
		movementPattern: "horizontal-push",
		equipmentId: "chest-press-machine",
		loadConvention: "machine-stack",
		unilateral: false,
		incrementKg: 2.5,
		restSecondsDefault: 120,
		muscles: [
			{ id: "pectoralis-major", name: "Pectoralis major", role: "primary" },
			{ id: "anterior-deltoid", name: "Anterior deltoid", role: "secondary" },
			{ id: "triceps", name: "Triceps", role: "secondary" },
		],
		asset: asset("chest-press"),
		cues: {
			setup: "Sit with back supported, handles near mid-chest, feet planted.",
			execution: "Press until the elbows are nearly straight, then return with control.",
			breathing: "Breathe out while pressing; breathe in while returning.",
			mistakes: "Shrugging the shoulders or bouncing the stack at the bottom.",
			stopGuidance: STOP,
		},
		accessibleAlternative: {
			kind: "static-sequence",
			posterPath: "/models/exercises/chest-press.png",
			summary: "Static start and press phases for the machine chest press.",
		},
	},
	{
		id: "cable-row",
		name: "Seated cable row",
		movementPattern: "horizontal-pull",
		equipmentId: "cable-machine",
		loadConvention: "machine-stack",
		unilateral: false,
		incrementKg: 2.5,
		restSecondsDefault: 90,
		muscles: [
			{ id: "latissimus-dorsi", name: "Latissimus dorsi", role: "primary" },
			{ id: "rhomboids", name: "Rhomboids", role: "primary" },
			{ id: "biceps", name: "Biceps", role: "secondary" },
			{ id: "posterior-deltoid", name: "Posterior deltoid", role: "secondary" },
		],
		asset: asset("cable-row"),
		cues: {
			setup: "Sit tall with feet on the platform, hold the handle with arms long.",
			execution: "Pull the handle to the torso, pause, then extend the arms with control.",
			breathing: "Breathe out while pulling; breathe in while extending.",
			mistakes: "Swinging the torso or shrugging the handles toward the ears.",
			stopGuidance: STOP,
		},
		accessibleAlternative: {
			kind: "static-sequence",
			posterPath: "/models/exercises/cable-row.png",
			summary: "Static reach and row phases for the seated cable row.",
		},
	},
	{
		id: "lat-pulldown",
		name: "Lat pulldown",
		movementPattern: "vertical-pull",
		equipmentId: "lat-pulldown-machine",
		loadConvention: "machine-stack",
		unilateral: false,
		incrementKg: 2.5,
		restSecondsDefault: 90,
		muscles: [
			{ id: "latissimus-dorsi", name: "Latissimus dorsi", role: "primary" },
			{ id: "biceps", name: "Biceps", role: "secondary" },
			{ id: "posterior-deltoid", name: "Posterior deltoid", role: "secondary" },
		],
		asset: asset("lat-pulldown"),
		cues: {
			setup: "Sit with thighs under the pad, grip the bar slightly wider than shoulders.",
			execution: "Pull the bar to the upper chest, then return until the arms are long.",
			breathing: "Breathe out while pulling; breathe in while returning.",
			mistakes: "Leaning far back, jerking the stack, or pulling the bar behind the neck.",
			stopGuidance: STOP,
		},
		accessibleAlternative: {
			kind: "static-sequence",
			posterPath: "/models/exercises/lat-pulldown.png",
			summary: "Static overhead and pulldown phases for the lat pulldown.",
		},
	},
	{
		id: "shoulder-press",
		name: "Dumbbell shoulder press",
		movementPattern: "vertical-push",
		equipmentId: "dumbbell",
		loadConvention: "per-hand",
		unilateral: false,
		incrementKg: 2,
		restSecondsDefault: 90,
		muscles: [
			{ id: "lateral-deltoid", name: "Lateral deltoid", role: "primary" },
			{ id: "anterior-deltoid", name: "Anterior deltoid", role: "primary" },
			{ id: "triceps", name: "Triceps", role: "secondary" },
			{ id: "trapezius", name: "Trapezius", role: "secondary" },
		],
		asset: asset("shoulder-press"),
		cues: {
			setup: "Sit or stand tall with a dumbbell at each shoulder, wrists stacked over elbows.",
			execution: "Press overhead through a comfortable range, then lower with control.",
			breathing: "Breathe out while pressing; breathe in while lowering.",
			mistakes: "Flaring the ribs, banging the bells together, or forcing end range.",
			stopGuidance: STOP,
		},
		accessibleAlternative: {
			kind: "static-sequence",
			posterPath: "/models/exercises/shoulder-press.png",
			summary: "Static rack and overhead phases for the dumbbell shoulder press.",
		},
	},
];

const EXERCISE_BY_ID = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));

export function listExercises(): ExerciseDefinition[] {
	return EXERCISES;
}

export function getExercise(id: StrengthExerciseId): ExerciseDefinition {
	const exercise = EXERCISE_BY_ID.get(id);
	if (!exercise) {
		throw new Error(`unknown_exercise:${id}`);
	}
	return exercise;
}

export function exercisesForEquipment(equipmentIds: readonly EquipmentId[]): ExerciseDefinition[] {
	const available = new Set(equipmentIds);
	return EXERCISES.filter((exercise) => available.has(exercise.equipmentId));
}

export { CATALOG_VERSION };
