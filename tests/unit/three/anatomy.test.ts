import { readFileSync } from "node:fs";
import { AnimationMixer, Box3, PerspectiveCamera, SkinnedMesh, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import { EXERCISES } from "../../../src/data/exercises";
import { FIELD_OF_VIEW, frameBounds } from "../../../src/three/framing";

async function anatomy() {
	const bytes = readFileSync(new URL("../../../public/models/rhino-anatomy.glb", import.meta.url));
	const gltf = await new GLTFLoader().parseAsync(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
		"",
	);
	const body = gltf.scene.getObjectByName("RhinoAnatomy");
	if (!(body instanceof SkinnedMesh)) throw new Error("Missing anatomy mesh");
	return { gltf, body };
}

describe("authored anatomy asset", () => {
	it("separates front biceps, rear triceps and shoulder caps on both arms", async () => {
		const { body } = await anatomy();
		const positions = body.geometry.attributes.position;
		const counts = { leftBiceps: 0, rightBiceps: 0, leftTriceps: 0, rightTriceps: 0, deltoids: 0 };
		for (let vertex = 0; vertex < positions.count; vertex++) {
			const point = new Vector3().fromBufferAttribute(positions, vertex);
			if (body.geometry.getAttribute("_region1").getX(vertex) === 1) {
				const side = point.x > 0 ? "L" : "R";
				const knee = body.skeleton
					.getBoneByName(`lowerleg01_${side}`)
					?.getWorldPosition(new Vector3());
				const ankle = body.skeleton.getBoneByName(`foot_${side}`)?.getWorldPosition(new Vector3());
				if (!knee || !ankle) throw new Error("Missing leg joints");
				const axis = ankle.clone().sub(knee);
				const along = point.clone().sub(knee).dot(axis) / axis.lengthSq();
				expect(point.z).toBeLessThan(knee.z + along * axis.z + 0.00001);
			}
			const biceps = body.geometry.getAttribute("_region1").getZ(vertex) === 1;
			const triceps = body.geometry.getAttribute("_region3").getX(vertex) === 1;
			const shoulderCap = body.geometry.getAttribute("_region1").getY(vertex) === 1;
			if (!biceps && !triceps && !shoulderCap) continue;
			const side = point.x > 0 ? "L" : "R";
			const shoulder = body.skeleton
				.getBoneByName(`upperarm01_${side}`)
				?.getWorldPosition(new Vector3());
			const elbow = body.skeleton
				.getBoneByName(`lowerarm01_${side}`)
				?.getWorldPosition(new Vector3());
			if (!shoulder || !elbow) throw new Error("Missing arm joints");
			const axis = elbow.clone().sub(shoulder);
			const along = point.clone().sub(shoulder).dot(axis) / axis.lengthSq();
			const center = shoulder.clone().addScaledVector(axis, along);
			if (shoulderCap) {
				expect(along).toBeLessThan(0.281);
				counts.deltoids++;
			} else {
				expect(along).toBeGreaterThanOrEqual(0.279);
				expect(along).toBeLessThan(1.15);
				if (biceps) {
					expect(point.z).toBeGreaterThan(center.z - 0.00001);
					counts[side === "L" ? "leftBiceps" : "rightBiceps"]++;
				} else {
					expect(point.z).toBeLessThan(center.z + 0.00001);
					counts[side === "L" ? "leftTriceps" : "rightTriceps"]++;
				}
			}
		}
		for (const count of Object.values(counts)) expect(count).toBeGreaterThan(40);
	});

	it("exports every catalog clip, populated target masks and matching static alternatives", async () => {
		const { body, gltf } = await anatomy();
		expect(gltf.animations.map((clip) => clip.name).sort()).toEqual(
			EXERCISES.map((exercise) => exercise.id).sort(),
		);
		for (const exercise of EXERCISES) {
			for (const region of exercise.highlightRegions) {
				const attribute = body.geometry.getAttribute(`_region${Math.floor((region - 1) / 3)}`);
				expect(
					Array.from({ length: attribute.count }, (_, vertex) =>
						attribute.getComponent(vertex, (region - 1) % 3),
					).filter((weight) => weight > 0).length,
				).toBeGreaterThan(40);
			}
			const poster = readFileSync(
				new URL(`../../../public${exercise.asset.posterPath}`, import.meta.url),
			);
			expect([...poster.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
			const clip = gltf.animations.find((clip) => clip.name === exercise.id);
			expect(
				clip?.tracks.some((track) => {
					const size = track.getValueSize();
					const midpoint = Math.floor(track.times.length / 2) * size;
					return Array.from(track.values.slice(0, size)).some(
						(value, axis) => Math.abs(value - track.values[midpoint + axis]) > 0.01,
					);
				}),
			).toBe(true);
		}
	});

	it("contains every sampled pose and fits front, side and rear at narrow and wide aspects", async () => {
		const { body, gltf } = await anatomy();
		const mixer = new AnimationMixer(gltf.scene);
		const point = new Vector3();
		const anchors = ["foot_L", "foot_R", "toe2-1_L", "toe2-1_R"].map((name) => {
			const bone = body.skeleton.getBoneByName(name);
			if (!bone) throw new Error("Missing foot anchor");
			return { bone, rest: bone.getWorldPosition(new Vector3()) };
		});
		for (const clip of gltf.animations) {
			const stored = body.userData.motionBounds[clip.name];
			const bounds = new Box3(new Vector3(...stored.min), new Vector3(...stored.max));
			mixer.stopAllAction();
			mixer.clipAction(clip).reset().play();
			const actual = new Box3();
			for (let frame = 0; frame <= 16; frame++) {
				mixer.setTime((clip.duration * frame) / 16);
				gltf.scene.updateMatrixWorld(true);
				body.skeleton.update();
				for (const { bone, rest } of anchors.filter(({ bone }) =>
					bone.name.startsWith(clip.name === "calf-raise" ? "toe" : "foot"),
				))
					expect(
						bone.getWorldPosition(point).distanceTo(rest),
						`${clip.name} contact`,
					).toBeLessThan(0.005);
				for (let vertex = 0; vertex < body.geometry.attributes.position.count; vertex++) {
					body.getVertexPosition(vertex, point);
					actual.expandByPoint(point);
				}
			}
			expect(bounds.clone().expandByScalar(0.0001).containsBox(actual), clip.name).toBe(true);
			for (const aspect of [0.65, 1, 2.2]) {
				for (const view of ["front", "side", "rear"] as const) {
					const camera = new PerspectiveCamera(FIELD_OF_VIEW, aspect, 0.05, 50);
					const fit = frameBounds(bounds, aspect, view);
					camera.position.copy(fit.position);
					camera.lookAt(fit.target);
					camera.updateMatrixWorld();
					for (const x of [bounds.min.x, bounds.max.x])
						for (const y of [bounds.min.y, bounds.max.y])
							for (const z of [bounds.min.z, bounds.max.z]) {
								const projected = new Vector3(x, y, z).project(camera);
								expect(Math.abs(projected.x), `${clip.name} ${view} horizontal`).toBeLessThan(1);
								expect(Math.abs(projected.y), `${clip.name} ${view} vertical`).toBeLessThan(1);
								expect(projected.z).toBeLessThan(1);
							}
				}
			}
		}
		mixer.stopAllAction();
		mixer.uncacheRoot(gltf.scene);
	});

	it("keeps hinged spines neutral, RDL knees stable and the load close to the leg", async () => {
		const { body, gltf } = await anatomy();
		const mixer = new AnimationMixer(gltf.scene);
		const bone = (name: string) => {
			const result = body.skeleton.getBoneByName(name);
			if (!result) throw new Error(`Missing joint ${name}`);
			return result;
		};
		const point = (name: string) => bone(name).getWorldPosition(new Vector3());
		const angle = (a: Vector3, center: Vector3, b: Vector3) =>
			(a.clone().sub(center).angleTo(b.clone().sub(center)) * 180) / Math.PI;
		for (const name of ["romanian-deadlift", "triceps-kickback", "bent-over-row"]) {
			const clip = gltf.animations.find((item) => item.name === name);
			if (!clip) throw new Error("Missing hinge clip");
			mixer.stopAllAction();
			mixer.clipAction(clip).reset().play();
			for (let sample = 0; sample <= 64; sample++) {
				mixer.setTime((sample / 64) * 4);
				gltf.scene.updateMatrixWorld(true);
				for (const spine of ["spine01", "spine02", "spine03", "spine04", "spine05"]) {
					expect(Math.abs(bone(spine).quaternion.w), `${name} neutral ${spine}`).toBeCloseTo(1, 5);
				}
				for (const side of ["L", "R"]) {
					const hip = point(`upperleg01_${side}`);
					const knee = point(`lowerleg01_${side}`);
					const ankle = point(`foot_${side}`);
					const wrist = point(`wrist_${side}`);
					const shoulder = point(`upperarm01_${side}`);
					const elbow = point(`lowerarm01_${side}`);
					if (name === "romanian-deadlift") {
						expect(angle(hip, knee, ankle), "stable slight knee bend").toBeCloseTo(158.9, 0);
						expect(angle(shoulder, elbow, wrist), "long arms").toBeGreaterThan(177);
						const fraction = Math.max(0, Math.min(1, (wrist.y - knee.y) / (hip.y - knee.y)));
						const leg = knee.clone().lerp(hip, fraction);
						expect(wrist.z - leg.z, "wrist close to front of leg").toBeGreaterThan(0.02);
						expect(wrist.z - leg.z, "wrist close to front of leg").toBeLessThan(0.13);
					}
				}
			}
		}
	});

	it("keeps a fixed pulldown grip in front of the face and soft lateral-raise elbows", async () => {
		const { gltf } = await anatomy();
		const mixer = new AnimationMixer(gltf.scene);
		const point = (name: string) => {
			const bone = gltf.scene.getObjectByName(name);
			if (!bone) throw new Error(`Missing ${name}`);
			return bone.getWorldPosition(new Vector3());
		};
		for (const name of ["lat-pulldown", "lateral-raise"]) {
			const clip = gltf.animations.find((item) => item.name === name);
			if (!clip) throw new Error("Missing arm clip");
			mixer.stopAllAction();
			mixer.clipAction(clip).reset().play();
			let initialWidth = 0;
			for (let sample = 0; sample <= 32; sample++) {
				mixer.setTime(sample / 8);
				gltf.scene.updateMatrixWorld(true);
				const left = point("wrist_L");
				if (name === "lat-pulldown") {
					const width = left.distanceTo(point("wrist_R"));
					if (!sample) initialWidth = width;
					expect(width).toBeCloseTo(initialWidth, 3);
					expect(left.z - point("head").z).toBeGreaterThan(0.04);
				} else {
					const elbow = point("lowerarm01_L");
					const internal =
						(point("upperarm01_L").sub(elbow).angleTo(left.sub(elbow)) * 180) / Math.PI;
					expect(internal).toBeGreaterThan(145);
					expect(internal).toBeLessThan(175);
				}
			}
		}
	});
});
