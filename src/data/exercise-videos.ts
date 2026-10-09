import type { StrengthExerciseId } from "../domain/contracts";

export type ExerciseVideoReference = {
	youtubeId: string;
	title: string;
	publisher: string;
	sourceTitle: string;
	url: string;
};

export const EXERCISE_VIDEO_REFERENCES: Record<StrengthExerciseId, ExerciseVideoReference> = {
	"goblet-squat": {
		youtubeId: "nfX7IFK9UNI",
		title: "高脚杯深蹲",
		publisher: "National Academy of Sports Medicine (NASM)",
		sourceTitle: "How to do a Goblet Squat | Proper Form & Technique | NASM",
		url: "https://www.youtube.com/watch?v=nfX7IFK9UNI",
	},
	"romanian-deadlift": {
		youtubeId: "aa57T45iFSE",
		title: "哑铃罗马尼亚硬拉",
		publisher: "National Academy of Sports Medicine (NASM)",
		sourceTitle: "How to do a Dumbbell Romanian Deadlift | Proper Form & Technique | NASM",
		url: "https://www.youtube.com/watch?v=aa57T45iFSE",
	},
	"chest-press": {
		youtubeId: "lRo9zZ7EwpM",
		title: "器械推胸",
		publisher: "National Academy of Sports Medicine (NASM)",
		sourceTitle: "How to do a Chest Press on a Machine | Proper Form & Technique | NASM",
		url: "https://www.youtube.com/watch?v=lRo9zZ7EwpM",
	},
	"cable-row": {
		youtubeId: "lJoozxC0Rns",
		title: "坐姿绳索划船",
		publisher: "PureGym",
		sourceTitle: "How To Do A Seated Cable Row",
		url: "https://www.youtube.com/watch?v=lJoozxC0Rns",
	},
	"lat-pulldown": {
		youtubeId: "JGeRYIZdojU",
		title: "高位下拉",
		publisher: "PureGym",
		sourceTitle: "How To Do A Lat Pulldown",
		url: "https://www.youtube.com/watch?v=JGeRYIZdojU",
	},
	"shoulder-press": {
		youtubeId: "MMjBnEBnZKM",
		title: "哑铃肩推",
		publisher: "National Academy of Sports Medicine (NASM)",
		sourceTitle: "How to do a Dumbbell Overhead Press",
		url: "https://www.youtube.com/watch?v=MMjBnEBnZKM",
	},
	"dumbbell-curl": {
		youtubeId: "cBSD6mQIPQk",
		title: "哑铃弯举",
		publisher: "Nuffield Health",
		sourceTitle: "Dumbbell Bicep Curl",
		url: "https://www.youtube.com/watch?v=cBSD6mQIPQk",
	},
	"triceps-kickback": {
		youtubeId: "64ru825KZQY",
		title: "双臂俯身哑铃臂屈伸",
		publisher: "Martyn Pace",
		sourceTitle: "Dumbbell Tricep Kickbacks - Both Arms",
		url: "https://www.youtube.com/watch?v=64ru825KZQY",
	},
	"lateral-raise": {
		youtubeId: "XPPfnSEATJA",
		title: "哑铃侧平举",
		publisher: "National Academy of Sports Medicine (NASM)",
		sourceTitle: "How to do a Dumbbell Lateral Raise",
		url: "https://www.youtube.com/watch?v=XPPfnSEATJA",
	},
	"bent-over-row": {
		youtubeId: "DJfQN6xJL28",
		title: "俯身哑铃划船",
		publisher: "National Academy of Sports Medicine (NASM)",
		sourceTitle: "How to do a Dumbbell Bent Over Row",
		url: "https://www.youtube.com/watch?v=DJfQN6xJL28",
	},
	"calf-raise": {
		youtubeId: "wxwY7GXxL4k",
		title: "站姿哑铃提踵",
		publisher: "Bodybuilding.com",
		sourceTitle: "Standing Dumbbell Calf Raises - Calf Exercise - Bodybuilding.com",
		url: "https://www.youtube.com/watch?v=wxwY7GXxL4k",
	},
};
