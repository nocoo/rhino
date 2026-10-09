import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

class BlobReader {
	readAsArrayBuffer(blob) {
		blob.arrayBuffer().then((value) => {
			this.result = value;
			this.onloadend?.();
		});
	}
	readAsDataURL(blob) {
		blob.arrayBuffer().then((value) => {
			this.result = `data:${blob.type};base64,${Buffer.from(value).toString("base64")}`;
			this.onloadend?.();
		});
	}
}
globalThis.FileReader = BlobReader;
const source = new URL("./makehuman/", import.meta.url);
const lines = readFileSync(new URL("base.obj", source), "utf8").split("\n");
const vertices = [];
const faces = [];
let body = false;
for (const line of lines) {
	const fields = line.trim().split(/\s+/);
	if (fields[0] === "v") vertices.push(fields.slice(1, 4).map(Number));
	if (fields[0] === "g") body = fields[1] === "body";
	if (fields[0] === "f" && body) {
		const polygon = fields.slice(1).map((f) => Number(f.split("/")[0]) - 1);
		for (let i = 1; i < polygon.length - 1; i++) faces.push(polygon[0], polygon[i], polygon[i + 1]);
	}
}
const targets = [
	"caucasian-male-young.target",
	"universal-male-young-maxmuscle-averageweight.target",
];
for (const target of targets) {
	for (const line of readFileSync(new URL(target, source), "utf8").split("\n")) {
		if (!/^\d/.test(line)) continue;
		const [index, ...delta] = line.split(/\s+/).map(Number);
		for (let axis = 0; axis < 3; axis++) vertices[index][axis] += delta[axis];
	}
}
const rig = JSON.parse(readFileSync(new URL("skeleton.json", source), "utf8"));
const weights = JSON.parse(readFileSync(new URL("weights.json", source), "utf8")).weights;
const names = Object.keys(rig.bones);
const namesToIndex = new Map(names.map((name, index) => [name, index]));
const joint = (name) => {
	const indices = rig.joints[name];
	return new THREE.Vector3(
		...[0, 1, 2].map(
			(axis) =>
				(indices.reduce((sum, index) => sum + vertices[index][axis], 0) / indices.length) * 0.1,
		),
	);
};
const floor = Math.min(...faces.map((index) => vertices[index][1])) * 0.1;
const heads = names.map((name) => joint(rig.bones[name].head).sub(new THREE.Vector3(0, floor, 0)));
const bones = names.map((name, index) => {
	const bone = new THREE.Bone();
	bone.name = name.replaceAll(".", "_");
	const parentIndex = namesToIndex.get(rig.bones[name].parent);
	bone.position.copy(heads[index]);
	if (parentIndex !== undefined) bone.position.sub(heads[parentIndex]);
	return bone;
});
for (let i = 0; i < bones.length; i++) {
	const parentIndex = namesToIndex.get(rig.bones[names[i]].parent);
	if (parentIndex !== undefined) bones[parentIndex].add(bones[i]);
}
const vertexWeights = vertices.map(() => []);
for (const [name, values] of Object.entries(weights)) {
	for (const [vertex, weight] of values)
		vertexWeights[vertex].push([namesToIndex.get(name), weight]);
}
const positions = [];
const skinIndices = [];
const skinWeights = [];
const regions = [];
const indices = [];
const mapped = new Map();
for (const oldIndex of faces) {
	if (!mapped.has(oldIndex)) {
		const [x, y, z] = vertices[oldIndex].map((v) => v * 0.1);
		positions.push(x, y - floor, z);
		const w = vertexWeights[oldIndex].sort((a, b) => b[1] - a[1]).slice(0, 4);
		const total = w.reduce((s, v) => s + v[1], 0) || 1;
		while (w.length < 4) w.push([0, 0]);
		skinIndices.push(...w.map((v) => v[0]));
		skinWeights.push(...w.map((v) => v[1] / total));
		const dominant = names[w[0][0]];
		let region = 0;
		if (dominant.includes("upperleg")) region = z > 0 ? 1 : 2;
		else if (dominant.includes("pelvis")) region = 3;
		else if (dominant.includes("lowerleg")) {
			const side = dominant.endsWith(".L") ? "L" : "R";
			const knee = heads[namesToIndex.get(`lowerleg01.${side}`)];
			const ankle = heads[namesToIndex.get(`foot.${side}`)];
			const axis = ankle.clone().sub(knee);
			const along = new THREE.Vector3(x, y - floor, z).sub(knee).dot(axis) / axis.lengthSq();
			region = z < knee.z + along * axis.z ? 4 : 0;
		} else if (dominant.includes("upperarm") || dominant.includes("shoulder")) {
			const side = dominant.endsWith(".L") ? "L" : "R";
			const shoulder = heads[namesToIndex.get(`upperarm01.${side}`)];
			const elbow = heads[namesToIndex.get(`lowerarm01.${side}`)];
			const point = new THREE.Vector3(x, y - floor, z);
			const axis = elbow.clone().sub(shoulder);
			const along = point.clone().sub(shoulder).dot(axis) / axis.lengthSq();
			const center = shoulder.clone().addScaledVector(axis, along);
			if (dominant.includes("shoulder") && Math.abs(x) < Math.abs(shoulder.x) - 0.015)
				region = z > shoulder.z ? 7 : 8;
			else region = along < 0.28 ? 5 : z > center.z ? 6 : 10;
		} else if (dominant.includes("spine") || dominant.includes("breast"))
			region = y > 0.3 ? (z > 0 ? 7 : 8) : 9;
		regions.push(region);
		mapped.set(oldIndex, mapped.size);
	}
	indices.push(mapped.get(oldIndex));
}
const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
for (let group = 0; group < 4; group++) {
	geometry.setAttribute(
		`_region${group}`,
		new THREE.Float32BufferAttribute(
			regions.flatMap((region) =>
				[1, 2, 3].map((offset) => (region === group * 3 + offset ? 1 : 0)),
			),
			3,
		),
	);
}
geometry.setIndex(indices);
geometry.computeVertexNormals();
const mesh = new THREE.SkinnedMesh(
	geometry,
	new THREE.MeshStandardMaterial({ color: 0xb0b3aa, roughness: 0.63, metalness: 0.08 }),
);
mesh.name = "RhinoAnatomy";
for (let i = 0; i < bones.length; i++) if (!rig.bones[names[i]].parent) mesh.add(bones[i]);
mesh.updateMatrixWorld(true);
mesh.bind(new THREE.Skeleton(bones));
const scene = new THREE.Scene();
scene.add(mesh);
const DEG = Math.PI / 180;
const clips = [];
const restArm = 27;
for (const id of [
	"goblet-squat",
	"romanian-deadlift",
	"chest-press",
	"cable-row",
	"lat-pulldown",
	"shoulder-press",
	"dumbbell-curl",
	"triceps-kickback",
	"lateral-raise",
	"bent-over-row",
	"calf-raise",
]) {
	const tracks = [];
	const angles = {};
	const set = (bone, a, b) => {
		angles[bone] = [a, b];
	};
	for (const side of ["L", "R"]) {
		const sign = side === "L" ? 1 : -1;
		set(`upperarm01.${side}`, [0, 0, -sign * restArm], [0, 0, -sign * restArm]);
		if (id === "goblet-squat") {
			set(`upperleg01.${side}`, [-5, 0, 0], [-65, 0, 0]);
			set(`lowerleg01.${side}`, [8, 0, 0], [95, 0, 0]);
			set(`foot.${side}`, [-3, 0, 0], [-30, 0, 0]);
			set(`upperarm01.${side}`, [-20, 0, -sign * 65], [-5, 0, -sign * 65]);
			set(`lowerarm01.${side}`, [-110, 0, sign * 10], [-110, 0, sign * 10]);
		}
		if (id === "romanian-deadlift") {
			set(`upperleg01.${side}`, [-4, 0, 0], [-48, 0, 0]);
			set(`lowerleg01.${side}`, [8, 0, 0], [20, 0, 0]);
			set(`foot.${side}`, [-4, 0, 0], [28, 0, 0]);
			set(`upperarm01.${side}`, [0, 0, -sign * restArm], [-45, 0, -sign * restArm]);
		}
		if (id === "triceps-kickback" || id === "bent-over-row") {
			set(`upperleg01.${side}`, [-30, 0, 0], [-30, 0, 0]);
			set(`lowerleg01.${side}`, [16, 0, 0], [16, 0, 0]);
			set(`foot.${side}`, [14, 0, 0], [14, 0, 0]);
		}
		if (id === "calf-raise") {
			set(`foot.${side}`, [0, 0, 0], [24, 0, 0]);
			for (let toe = 1; toe <= 5; toe++) set(`toe${toe}-1.${side}`, [0, 0, 0], [-24, 0, 0]);
		}
		if (id === "chest-press") {
			set(`upperarm01.${side}`, [-70, 0, sign * 30], [-90, 0, -sign * 15]);
			set(`lowerarm01.${side}`, [-90, 0, 0], [0, 0, 0]);
		}
		if (id === "cable-row") {
			set(`upperarm01.${side}`, [-75, 0, -sign * 20], [10, 0, -sign * 20]);
			set(`lowerarm01.${side}`, [0, 0, 0], [-100, 0, 0]);
		}
		if (id === "lat-pulldown") {
			set(`upperarm01.${side}`, [0, 0, sign * 130], [0, 0, sign * 30]);
			set(`lowerarm01.${side}`, [-10, 0, 0], [-100, 0, 0]);
		}
		if (id === "shoulder-press") {
			set(`upperarm01.${side}`, [0, 0, sign * 50], [0, 0, sign * 135]);
			set(`lowerarm01.${side}`, [-100, 0, 0], [-8, 0, 0]);
		}
		if (["chest-press", "cable-row", "lat-pulldown"].includes(id)) {
			set(`upperleg01.${side}`, [-85, 0, 0], [-85, 0, 0]);
			set(`lowerleg01.${side}`, [85, 0, 0], [85, 0, 0]);
		}
	}
	if (id === "goblet-squat") set("spine05", [5, 0, 0], [24, 0, 0]);
	if (id === "romanian-deadlift") set("spine05", [0, 0, 0], [55, 0, 0]);
	if (id === "triceps-kickback" || id === "bent-over-row") set("spine05", [40, 0, 0], [40, 0, 0]);
	const root = heads[namesToIndex.get("root")];
	const delta =
		id === "goblet-squat"
			? new THREE.Vector3(0, -0.34, -0.22)
			: id === "romanian-deadlift"
				? new THREE.Vector3(0, -0.06, -0.22)
				: new THREE.Vector3();
	const seat = ["chest-press", "cable-row", "lat-pulldown"].includes(id)
		? new THREE.Vector3(0, -0.42, 0)
		: new THREE.Vector3();
	const times = [0, 2, 4];
	const sampled = new Map(bones.map((bone) => [bone.name, []]));
	const rootValues = [];
	const align = (name, tip, direction) => {
		const bone = bones[namesToIndex.get(name)];
		const rest = heads[namesToIndex.get(tip)]
			.clone()
			.sub(heads[namesToIndex.get(name)])
			.normalize();
		const desired = new THREE.Quaternion().setFromUnitVectors(rest, direction.normalize());
		const parentWorld = bone.parent.getWorldQuaternion(new THREE.Quaternion());
		bone.quaternion.copy(parentWorld.invert().multiply(desired));
		mesh.updateMatrixWorld(true);
	};
	for (let frame = 0; frame < 3; frame++) {
		const phase = frame === 1 ? 1 : 0;
		for (const bone of bones) bone.quaternion.identity();
		for (const [bone, poses] of Object.entries(angles))
			bones[namesToIndex.get(bone)].quaternion.setFromEuler(
				new THREE.Euler(...poses[phase].map((n) => n * DEG)),
			);
		bones[namesToIndex.get("root")].position.copy(root).add(seat).addScaledVector(delta, phase);
		mesh.updateMatrixWorld(true);
		for (const side of ["L", "R"]) {
			const sign = side === "L" ? 1 : -1;
			const shoulder = bones[namesToIndex.get(`upperarm01.${side}`)].getWorldPosition(
				new THREE.Vector3(),
			);
			let elbowGoal, wristGoal;
			if (id === "goblet-squat") {
				elbowGoal = shoulder.clone().add(new THREE.Vector3(sign * 0.015, -0.27, 0.12));
				wristGoal = shoulder.clone().add(new THREE.Vector3(-sign * 0.13, -0.15, 0.31));
			} else if (id === "romanian-deadlift" || id === "calf-raise") {
				elbowGoal = shoulder.clone().add(new THREE.Vector3(sign * 0.02, -0.29, 0.01));
				wristGoal = elbowGoal.clone().add(new THREE.Vector3(sign * 0.025, -0.27, 0.015));
			} else if (id === "chest-press") {
				elbowGoal = shoulder
					.clone()
					.add(new THREE.Vector3(sign * (phase ? 0.03 : 0.19), -0.08, phase ? 0.3 : 0.02));
				wristGoal = elbowGoal
					.clone()
					.add(new THREE.Vector3(-sign * 0.06, 0.02, phase ? 0.27 : 0.23));
			} else if (id === "cable-row") {
				elbowGoal = shoulder
					.clone()
					.add(new THREE.Vector3(sign * 0.06, -0.2, phase ? -0.08 : 0.24));
				wristGoal = elbowGoal
					.clone()
					.add(new THREE.Vector3(-sign * 0.05, phase ? 0.03 : -0.04, 0.25));
			} else if (id === "dumbbell-curl") {
				elbowGoal = shoulder.clone().add(new THREE.Vector3(sign * 0.02, -0.29, 0));
				wristGoal = elbowGoal
					.clone()
					.add(new THREE.Vector3(0, phase ? 0.22 : -0.26, phase ? 0.16 : 0.04));
			} else if (id === "triceps-kickback") {
				elbowGoal = shoulder.clone().add(new THREE.Vector3(sign * 0.02, -0.09, -0.27));
				wristGoal = elbowGoal
					.clone()
					.add(new THREE.Vector3(0, phase ? -0.08 : -0.27, phase ? -0.26 : 0.02));
			} else if (id === "lateral-raise") {
				elbowGoal = shoulder
					.clone()
					.add(new THREE.Vector3(sign * (phase ? 0.29 : 0.06), phase ? -0.04 : -0.29, 0.04));
				wristGoal = elbowGoal
					.clone()
					.add(new THREE.Vector3(sign * (phase ? 0.25 : 0.04), phase ? -0.06 : -0.26, 0.06));
			} else if (id === "bent-over-row") {
				elbowGoal = shoulder
					.clone()
					.add(new THREE.Vector3(sign * 0.04, phase ? -0.06 : -0.29, phase ? -0.28 : 0));
				wristGoal = elbowGoal.clone().add(new THREE.Vector3(0, -0.26, phase ? 0.07 : 0));
			} else {
				const high = id === "lat-pulldown" ? !phase : phase;
				const elbowDrop = id === "lat-pulldown" ? -0.22 : 0;
				elbowGoal = shoulder
					.clone()
					.add(new THREE.Vector3(sign * (high ? 0.15 : 0.28), high ? 0.28 : elbowDrop, 0));
				wristGoal = elbowGoal
					.clone()
					.add(new THREE.Vector3(sign * (high ? 0.03 : -0.015), high ? 0.26 : 0.27, 0.02));
			}
			align(`upperarm01.${side}`, `lowerarm01.${side}`, elbowGoal.clone().sub(shoulder));
			const elbow = bones[namesToIndex.get(`lowerarm01.${side}`)].getWorldPosition(
				new THREE.Vector3(),
			);
			align(`lowerarm01.${side}`, `wrist.${side}`, wristGoal.clone().sub(elbow));
			for (let finger = 2; finger <= 5; finger++)
				for (let segment = 1; segment <= 3; segment++) {
					const bone = bones[namesToIndex.get(`finger${finger}-${segment}.${side}`)];
					bone.quaternion.setFromEuler(new THREE.Euler(1.1, 0, sign * 0.04));
				}
		}
		if (["triceps-kickback", "bent-over-row", "calf-raise"].includes(id)) {
			const anchor = namesToIndex.get(id === "calf-raise" ? "toe2-1.L" : "foot.L");
			const offset = heads[anchor].clone().sub(bones[anchor].getWorldPosition(new THREE.Vector3()));
			bones[namesToIndex.get("root")].position.add(offset);
			mesh.updateMatrixWorld(true);
		}
		for (const bone of bones) sampled.get(bone.name).push(...bone.quaternion.toArray());
		rootValues.push(...bones[namesToIndex.get("root")].position.toArray());
	}
	for (const bone of bones)
		tracks.push(
			new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, sampled.get(bone.name)),
		);
	tracks.push(new THREE.VectorKeyframeTrack("root.position", times, rootValues));
	clips.push(new THREE.AnimationClip(id, 4, tracks));
}
const motionBounds = {};
const mixer = new THREE.AnimationMixer(mesh);
for (const clip of clips) {
	mixer.stopAllAction();
	mixer.clipAction(clip).reset().play();
	const bounds = new THREE.Box3();
	const muscleBounds = Array.from({ length: 11 }, () => new THREE.Box3());
	const point = new THREE.Vector3();
	for (let sample = 0; sample <= 32; sample++) {
		mixer.setTime((clip.duration * sample) / 32);
		mesh.updateMatrixWorld(true);
		mesh.skeleton.update();
		for (let vertex = 0; vertex < regions.length; vertex++) {
			mesh.getVertexPosition(vertex, point);
			bounds.expandByPoint(point);
			muscleBounds[regions[vertex]].expandByPoint(point);
		}
	}
	motionBounds[clip.name] = {
		min: bounds.min.toArray(),
		max: bounds.max.toArray(),
		regions: muscleBounds.map((region) => ({
			min: region.min.toArray(),
			max: region.max.toArray(),
		})),
	};
}
mixer.stopAllAction();
mixer.uncacheRoot(mesh);
mesh.userData.motionBounds = motionBounds;
for (let i = 0; i < bones.length; i++) {
	bones[i].quaternion.identity();
	const parent = namesToIndex.get(rig.bones[names[i]].parent);
	bones[i].position.copy(heads[i]);
	if (parent !== undefined) bones[i].position.sub(heads[parent]);
}
mesh.updateMatrixWorld(true);
const output = await new GLTFExporter().parseAsync(scene, {
	binary: true,
	animations: clips,
	onlyVisible: true,
});
writeFileSync(new URL("../public/models/rhino-anatomy.glb", import.meta.url), Buffer.from(output));
console.log(
	`Built ${mapped.size} vertices, ${indices.length / 3} triangles, ${clips.length} authored clips, ${output.byteLength} bytes`,
);
