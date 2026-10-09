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
		| "vertical-push"
		| "elbow-flexion"
		| "elbow-extension"
		| "shoulder-abduction"
		| "plantar-flexion";
	equipmentId: EquipmentId;
	loadConvention: LoadConvention;
	unilateral: boolean;
	incrementKg: number;
	restSecondsDefault: number;
	muscles: MuscleRole[];
	highlightRegions: number[];
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
	{ id: "dumbbell", name: "哑铃" },
	{ id: "bench", name: "训练凳" },
	{ id: "cable-machine", name: "坐姿划船机" },
	{ id: "lat-pulldown-machine", name: "高位下拉机" },
	{ id: "chest-press-machine", name: "坐姿推胸机" },
];

export const EXERCISES: ExerciseDefinition[] = [
	{
		id: "goblet-squat",
		name: "高脚杯深蹲",
		movementPattern: "squat",
		equipmentId: "dumbbell",
		loadConvention: "total-external",
		unilateral: false,
		incrementKg: 2,
		restSecondsDefault: 120,
		muscles: [
			{ id: "quadriceps", name: "股四头肌", role: "primary" },
			{ id: "gluteus-maximus", name: "臀大肌", role: "primary" },
			{ id: "hamstrings", name: "腘绳肌", role: "secondary" },
			{ id: "core", name: "核心肌群", role: "secondary" },
		],
		highlightRegions: [1, 3],
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
		name: "哑铃罗马尼亚硬拉",
		movementPattern: "hinge",
		equipmentId: "dumbbell",
		loadConvention: "per-hand",
		unilateral: false,
		incrementKg: 2,
		restSecondsDefault: 120,
		muscles: [
			{ id: "hamstrings", name: "腘绳肌", role: "primary" },
			{ id: "gluteus-maximus", name: "臀大肌", role: "primary" },
			{ id: "erector-spinae", name: "竖脊肌", role: "secondary" },
		],
		highlightRegions: [2, 3],
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
		name: "器械推胸",
		movementPattern: "horizontal-push",
		equipmentId: "chest-press-machine",
		loadConvention: "machine-stack",
		unilateral: false,
		incrementKg: 2.5,
		restSecondsDefault: 120,
		muscles: [
			{ id: "pectoralis-major", name: "胸大肌", role: "primary" },
			{ id: "anterior-deltoid", name: "三角肌前束", role: "secondary" },
			{ id: "triceps", name: "肱三头肌", role: "secondary" },
		],
		highlightRegions: [7, 10],
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
		name: "坐姿绳索划船",
		movementPattern: "horizontal-pull",
		equipmentId: "cable-machine",
		loadConvention: "machine-stack",
		unilateral: false,
		incrementKg: 2.5,
		restSecondsDefault: 90,
		muscles: [
			{ id: "latissimus-dorsi", name: "背阔肌", role: "primary" },
			{ id: "rhomboids", name: "菱形肌", role: "primary" },
			{ id: "biceps", name: "肱二头肌", role: "secondary" },
			{ id: "posterior-deltoid", name: "三角肌后束", role: "secondary" },
		],
		highlightRegions: [8, 6],
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
		name: "高位下拉",
		movementPattern: "vertical-pull",
		equipmentId: "lat-pulldown-machine",
		loadConvention: "machine-stack",
		unilateral: false,
		incrementKg: 2.5,
		restSecondsDefault: 90,
		muscles: [
			{ id: "latissimus-dorsi", name: "背阔肌", role: "primary" },
			{ id: "biceps", name: "肱二头肌", role: "secondary" },
			{ id: "posterior-deltoid", name: "三角肌后束", role: "secondary" },
		],
		highlightRegions: [8, 6],
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
		name: "哑铃肩推",
		movementPattern: "vertical-push",
		equipmentId: "dumbbell",
		loadConvention: "per-hand",
		unilateral: false,
		incrementKg: 2,
		restSecondsDefault: 90,
		muscles: [
			{ id: "lateral-deltoid", name: "三角肌中束", role: "primary" },
			{ id: "anterior-deltoid", name: "三角肌前束", role: "primary" },
			{ id: "triceps", name: "肱三头肌", role: "secondary" },
			{ id: "trapezius", name: "斜方肌", role: "secondary" },
		],
		highlightRegions: [5, 10],
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
	{
		id: "dumbbell-curl",
		name: "哑铃弯举",
		movementPattern: "elbow-flexion",
		equipmentId: "dumbbell",
		loadConvention: "per-hand",
		unilateral: false,
		incrementKg: 1,
		restSecondsDefault: 60,
		muscles: [
			{ id: "biceps", name: "肱二头肌", role: "primary" },
			{ id: "brachialis", name: "肱肌", role: "secondary" },
			{ id: "forearms", name: "前臂肌群", role: "secondary" },
		],
		highlightRegions: [6],
		asset: asset("dumbbell-curl"),
		cues: {
			setup:
				"Stand tall with a dumbbell in each hand, arms relaxed by the sides and palms facing forward.",
			execution:
				"Bend the elbows to curl the weights toward the shoulders, then lower with control.",
			breathing: "Breathe out while curling; breathe in while lowering.",
			mistakes:
				"Swinging the torso, moving the elbows forward, or using a range that causes discomfort.",
			stopGuidance: STOP,
		},
		accessibleAlternative: {
			kind: "static-sequence",
			posterPath: "/models/exercises/dumbbell-curl.png",
			summary: "Static lowered and curled phases for the dumbbell biceps curl.",
		},
	},
	{
		id: "triceps-kickback",
		name: "俯身哑铃臂屈伸",
		movementPattern: "elbow-extension",
		equipmentId: "dumbbell",
		loadConvention: "per-hand",
		unilateral: false,
		incrementKg: 1,
		restSecondsDefault: 60,
		muscles: [
			{ id: "triceps", name: "肱三头肌", role: "primary" },
			{ id: "posterior-deltoid", name: "三角肌后束", role: "secondary" },
		],
		highlightRegions: [10],
		asset: asset("triceps-kickback"),
		cues: {
			setup:
				"Hinge forward with a stable torso, hold a dumbbell in each hand, and keep the upper arms beside the body.",
			execution:
				"Straighten the elbows to move the weights back, then bend them to return without swinging the upper arms.",
			breathing: "Breathe out while straightening the arms; breathe in while returning.",
			mistakes:
				"Rounding the back, swinging the weights, or letting the upper arms drift during each repetition.",
			stopGuidance: STOP,
		},
		accessibleAlternative: {
			kind: "static-sequence",
			posterPath: "/models/exercises/triceps-kickback.png",
			summary: "Static bent-elbow and extended-elbow phases for the triceps kickback.",
		},
	},
	{
		id: "lateral-raise",
		name: "哑铃侧平举",
		movementPattern: "shoulder-abduction",
		equipmentId: "dumbbell",
		loadConvention: "per-hand",
		unilateral: false,
		incrementKg: 1,
		restSecondsDefault: 60,
		muscles: [
			{ id: "lateral-deltoid", name: "三角肌中束", role: "primary" },
			{ id: "trapezius", name: "斜方肌", role: "secondary" },
		],
		highlightRegions: [5],
		asset: asset("lateral-raise"),
		cues: {
			setup:
				"Stand tall with a light dumbbell in each hand, arms beside the body and elbows softly bent.",
			execution: "Raise the arms out to the sides within a comfortable range, then lower slowly.",
			breathing: "Breathe out while raising; breathe in while lowering.",
			mistakes:
				"Swinging the torso, shrugging toward the ears, or raising through a painful range.",
			stopGuidance: STOP,
		},
		accessibleAlternative: {
			kind: "static-sequence",
			posterPath: "/models/exercises/lateral-raise.png",
			summary: "Static lowered and raised phases for the dumbbell lateral raise.",
		},
	},
	{
		id: "bent-over-row",
		name: "俯身哑铃划船",
		movementPattern: "horizontal-pull",
		equipmentId: "dumbbell",
		loadConvention: "per-hand",
		unilateral: false,
		incrementKg: 2,
		restSecondsDefault: 90,
		muscles: [
			{ id: "latissimus-dorsi", name: "背阔肌", role: "primary" },
			{ id: "rhomboids", name: "菱形肌", role: "primary" },
			{ id: "biceps", name: "肱二头肌", role: "secondary" },
			{ id: "posterior-deltoid", name: "三角肌后束", role: "secondary" },
		],
		highlightRegions: [8, 6],
		asset: asset("bent-over-row"),
		cues: {
			setup:
				"Hold a dumbbell in each hand, hinge at the hips with softly bent knees, and keep the back comfortable and steady.",
			execution:
				"Pull the elbows toward the hips, then lower the weights with control while keeping the torso still.",
			breathing: "Breathe out while rowing; breathe in while lowering.",
			mistakes:
				"Rounding or twisting the torso, jerking the weights, or shrugging toward the ears.",
			stopGuidance: STOP,
		},
		accessibleAlternative: {
			kind: "static-sequence",
			posterPath: "/models/exercises/bent-over-row.png",
			summary: "Static hinged and row phases for the dumbbell bent-over row.",
		},
	},
	{
		id: "calf-raise",
		name: "哑铃提踵",
		movementPattern: "plantar-flexion",
		equipmentId: "dumbbell",
		loadConvention: "per-hand",
		unilateral: false,
		incrementKg: 2,
		restSecondsDefault: 60,
		muscles: [
			{ id: "gastrocnemius", name: "腓肠肌", role: "primary" },
			{ id: "soleus", name: "比目鱼肌", role: "secondary" },
		],
		highlightRegions: [4],
		asset: asset("calf-raise"),
		cues: {
			setup:
				"Stand with feet about hip-width, hold a dumbbell in each hand, and use light support if needed for balance.",
			execution:
				"Rise onto the balls of both feet, pause briefly, then lower the heels with control.",
			breathing: "Breathe out while rising; breathe in while lowering.",
			mistakes:
				"Bouncing, rolling onto the outer edges of the feet, or using a range that causes discomfort.",
			stopGuidance: STOP,
		},
		accessibleAlternative: {
			kind: "static-sequence",
			posterPath: "/models/exercises/calf-raise.png",
			summary: "Static heels-lowered and heels-raised phases for the dumbbell calf raise.",
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
