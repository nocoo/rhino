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
					return Array.from(track.values.slice(0, size)).some(
						(value, axis) => Math.abs(value - track.values[size + axis]) > 0.01,
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
				if (["triceps-kickback", "bent-over-row", "calf-raise"].includes(clip.name)) {
					for (const { bone, rest } of anchors.filter(({ bone }) =>
						bone.name.startsWith(clip.name === "calf-raise" ? "toe" : "foot"),
					))
						expect(
							bone.getWorldPosition(point).distanceTo(rest),
							`${clip.name} contact`,
						).toBeLessThan(0.005);
				}
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
});
