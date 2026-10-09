import {
	AmbientLight,
	AnimationMixer,
	Box3,
	BoxGeometry,
	Clock,
	CylinderGeometry,
	DirectionalLight,
	Group,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	SkinnedMesh,
	SRGBColorSpace,
	Vector3,
	WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { type GLTF, GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { getExercise } from "../data/exercises";
import type { StrengthExerciseId } from "../domain/contracts";
import { type CameraView, FIELD_OF_VIEW, frameBounds } from "./framing";

export type SceneController = {
	setExercise: (id: StrengthExerciseId) => void;
	setPlaying: (playing: boolean) => void;
	setProgress: (progress: number) => void;
	setMuscles: (enabled: boolean) => void;
	setCamera: (view: CameraView) => void;
	dispose: () => void;
};

export async function createExerciseScene(
	host: HTMLElement,
	exercise: StrengthExerciseId,
	onProgress: (value: number) => void,
	onUnavailable: () => void = () => {},
): Promise<SceneController> {
	const renderer = new WebGLRenderer({ antialias: true, alpha: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
	renderer.outputColorSpace = SRGBColorSpace;
	renderer.setClearColor(0x000000, 0);
	renderer.domElement.setAttribute(
		"aria-label",
		"可旋转的三维动作示意，完整操作与文字说明在画布外",
	);
	host.appendChild(renderer.domElement);
	const scene = new Scene();
	const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.05, 50);
	const controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = false;
	renderer.domElement.style.touchAction = "pan-y";
	controls.enablePan = false;
	controls.minDistance = 1.1;
	controls.maxDistance = 15;
	controls.minPolarAngle = 0.25;
	controls.maxPolarAngle = Math.PI / 2 + 0.1;
	scene.add(new HemisphereLight(0xeaf4ff, 0x4e534b, 2));
	scene.add(new AmbientLight(0xffffff, 0.4));
	const key = new DirectionalLight(0xffedd8, 3.5);
	key.position.set(-2, 3, 3);
	scene.add(key);
	const rim = new DirectionalLight(0xc3d7e7, 2.5);
	rim.position.set(2, 2, -2);
	scene.add(rim);
	const floor = new Mesh(
		new PlaneGeometry(6, 6),
		new MeshStandardMaterial({
			color: 0x404941,
			roughness: 1,
			transparent: true,
			opacity: 0.13,
		}),
	);
	floor.rotation.x = -Math.PI / 2;
	floor.position.y = -0.01;
	scene.add(floor);
	const equipment = new Group();
	scene.add(equipment);
	let disposed = false;
	let playing = false;
	let visible = true;
	let currentId = exercise;
	let showMuscles = true;
	let mixer: AnimationMixer;
	let duration = 4;
	let model: Group;
	let view: CameraView = "front";
	let direction: Exclude<CameraView, "detail"> = "front";
	const bounds = new Box3(new Vector3(-0.6, 0, -0.3), new Vector3(0.6, 2.3, 0.5));
	const detailBounds = new Box3();
	let body: SkinnedMesh;
	const metal = new MeshStandardMaterial({ color: 0x444c47, metalness: 0.55, roughness: 0.48 });
	const pad = new MeshStandardMaterial({ color: 0x3e4c43, roughness: 0.92 });
	let updateEquipment = () => {};
	const render = () => {
		if (!disposed && visible && !document.hidden) {
			updateEquipment();
			renderer.render(scene, camera);
		}
	};
	controls.addEventListener("change", render);
	const uniforms = {
		mask0: { value: new Vector3(1, 0, 1) },
		mask1: { value: new Vector3() },
		mask2: { value: new Vector3() },
		mask3: { value: new Vector3() },
		highlight: { value: 1 },
	};
	const resize = () => {
		const width = host.clientWidth;
		const height = host.clientHeight;
		renderer.setSize(width, height);
		camera.aspect = width / Math.max(height, 1);
		camera.updateProjectionMatrix();
		cameraView(view);
	};
	const observer = new ResizeObserver(resize);
	observer.observe(host);
	const intersection = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		updateLoop();
	});
	intersection.observe(host);
	const cameraView = (nextView: CameraView) => {
		view = nextView;
		if (view !== "detail") direction = view;
		const fit = frameBounds(
			view === "detail" && !detailBounds.isEmpty() ? detailBounds : bounds,
			camera.aspect,
			direction,
		);
		controls.target.copy(fit.target);
		camera.position.copy(fit.position);
		controls.update();
		render();
	};
	cameraView("front");
	resize();
	const material = new MeshStandardMaterial({ color: 0xa5afa6, roughness: 0.57, metalness: 0.12 });
	material.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, uniforms);
		shader.vertexShader =
			`attribute vec3 _region0; attribute vec3 _region1; attribute vec3 _region2; attribute vec3 _region3; varying vec3 vRegion0; varying vec3 vRegion1; varying vec3 vRegion2; varying vec3 vRegion3;\n${shader.vertexShader}`.replace(
				"#include <begin_vertex>",
				"#include <begin_vertex>\nvRegion0 = _region0; vRegion1 = _region1; vRegion2 = _region2; vRegion3 = _region3;",
			);
		shader.fragmentShader =
			`varying vec3 vRegion0; varying vec3 vRegion1; varying vec3 vRegion2; varying vec3 vRegion3; uniform vec3 mask0; uniform vec3 mask1; uniform vec3 mask2; uniform vec3 mask3; uniform float highlight;\n${shader.fragmentShader}`.replace(
				"#include <color_fragment>",
				`#include <color_fragment>
      float targeted = clamp(dot(vRegion0,mask0)+dot(vRegion1,mask1)+dot(vRegion2,mask2)+dot(vRegion3,mask3),0.0,1.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.87,0.37,0.13), targeted * highlight * 0.82);`,
			);
	};
	const dispose = () => {
		disposed = true;
		renderer.setAnimationLoop(null);
		observer.disconnect();
		intersection.disconnect();
		controls.dispose();
		document.removeEventListener("visibilitychange", updateLoop);
		renderer.domElement.removeEventListener("webglcontextlost", contextLost);
		if (mixer && model) {
			mixer.stopAllAction();
			mixer.uncacheRoot(model);
		}
		scene.traverse((object) => {
			if (object instanceof Mesh) {
				object.geometry.dispose();
				for (const item of Array.isArray(object.material) ? object.material : [object.material])
					item.dispose();
			}
			if (object instanceof SkinnedMesh) object.skeleton.dispose();
		});
		metal.dispose();
		pad.dispose();
		material.dispose();
		renderer.dispose();
		renderer.domElement.remove();
	};
	let gltf: GLTF;
	try {
		gltf = await new GLTFLoader().loadAsync("/models/rhino-anatomy.glb");
	} catch (error) {
		dispose();
		throw error;
	}
	model = gltf.scene;
	model.traverse((object) => {
		if (object instanceof SkinnedMesh) {
			body = object;
			for (const original of Array.isArray(object.material) ? object.material : [object.material])
				original.dispose();
			object.material = material;
			object.frustumCulled = false;
		}
	});
	scene.add(model);
	mixer = new AnimationMixer(model);
	const handheld: Group[] = [];
	const rod = (radius = 0.015) => {
		const item = new Mesh(new CylinderGeometry(radius, radius, 1, 12), metal);
		equipment.add(item);
		return item;
	};
	const connect = (item: Mesh, from: Vector3, to: Vector3) => {
		const direction = to.clone().sub(from);
		item.position.copy(from).add(to).multiplyScalar(0.5);
		item.scale.y = direction.length();
		item.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
	};
	const clearEquipment = () => {
		for (const child of [...equipment.children, ...handheld]) {
			child.traverse((item) => {
				if (item instanceof Mesh) item.geometry.dispose();
			});
			child.removeFromParent();
		}
		handheld.length = 0;
	};
	const dumbbell = (vertical = false) => {
		const group = new Group();
		const handle = new Mesh(new CylinderGeometry(0.012, 0.012, 0.16, 12), metal);
		handle.rotation.z = vertical ? 0 : Math.PI / 2;
		group.add(handle);
		for (const sign of [-1, 1]) {
			const plate = new Mesh(new CylinderGeometry(0.065, 0.065, 0.045, 20), metal);
			if (vertical) plate.position.y = sign * 0.08;
			else {
				plate.rotation.z = Math.PI / 2;
				plate.position.x = sign * 0.08;
			}
			group.add(plate);
		}
		return group;
	};
	const setExercise = (id: StrengthExerciseId) => {
		currentId = id;
		const clip = gltf.animations.find((item) => item.name === id);
		mixer.stopAllAction();
		if (clip) {
			duration = clip.duration;
			mixer.clipAction(clip).reset().play();
			mixer.setTime(0);
		}
		const selected = getExercise(id).highlightRegions;
		[uniforms.mask0, uniforms.mask1, uniforms.mask2, uniforms.mask3].forEach((mask, group) => {
			mask.value.set(
				...([1, 2, 3].map((offset) => (selected.includes(group * 3 + offset) ? 1 : 0)) as [
					number,
					number,
					number,
				]),
			);
		});
		clearEquipment();
		updateEquipment = () => {};
		if (["chest-press", "cable-row", "lat-pulldown"].includes(id)) {
			const seat = new Mesh(new BoxGeometry(0.38, 0.1, 0.36), pad);
			seat.position.set(0, 0.44, 0);
			equipment.add(seat);
			const leg = new Mesh(new CylinderGeometry(0.035, 0.035, 0.44, 12), metal);
			leg.position.set(0, 0.22, 0);
			equipment.add(leg);
			if (id === "chest-press") {
				const back = new Mesh(new BoxGeometry(0.36, 0.58, 0.09), pad);
				back.position.set(0, 0.81, -0.14);
				equipment.add(back);
			}
			const grips: Group[] = [];
			for (const side of ["L", "R"]) {
				const wrist = model.getObjectByName(`wrist_${side}`);
				if (wrist) {
					const handle = new Group();
					handle.add(new Mesh(new CylinderGeometry(0.018, 0.018, 0.15, 12), metal));
					handle.position.set(0, -0.065, 0.08);
					wrist.add(handle);
					handheld.push(handle);
					grips.push(handle);
				}
			}
			const top = id === "lat-pulldown" ? new Vector3(0, 2.25, 0.12) : new Vector3(0, 0.73, 0.95);
			const stand = rod(0.025);
			const postTop = top.clone();
			if (id === "lat-pulldown") postTop.z = -0.6;
			connect(stand, new Vector3(postTop.x, 0, postTop.z), postTop);
			if (id === "lat-pulldown") connect(rod(0.025), postTop, top);
			const base = rod(0.025);
			connect(base, new Vector3(-0.4, 0.03, postTop.z), new Vector3(0.4, 0.03, postTop.z));
			const bar = rod();
			const cable = rod(0.004);
			updateEquipment = () => {
				model.updateMatrixWorld(true);
				const left = grips[0].getWorldPosition(new Vector3());
				const right = grips[1].getWorldPosition(new Vector3());
				connect(bar, left, right);
				connect(cable, left.add(right).multiplyScalar(0.5), top);
			};
		}
		if (getExercise(id).equipmentId === "dumbbell") {
			for (const side of id === "goblet-squat" ? ["L"] : ["L", "R"]) {
				const wrist = model.getObjectByName(`wrist_${side}`);
				if (wrist) {
					const weight = dumbbell(id === "goblet-squat");
					weight.position.set(0, -0.065, 0.08);
					wrist.add(weight);
					handheld.push(weight);
				}
			}
		}
		const motion = body.userData.motionBounds[id];
		bounds
			.set(
				new Vector3(...(motion.min as [number, number, number])),
				new Vector3(...(motion.max as [number, number, number])),
			)
			.expandByScalar(0.16);
		if (id === "lat-pulldown") bounds.expandByPoint(new Vector3(0, 2.3, -0.65));
		if (["chest-press", "cable-row"].includes(id)) bounds.expandByPoint(new Vector3(0, 0.73, 1));
		detailBounds.makeEmpty();
		for (const region of selected) {
			const area = motion.regions[region];
			detailBounds.union(
				new Box3(
					new Vector3(...(area.min as [number, number, number])),
					new Vector3(...(area.max as [number, number, number])),
				),
			);
		}
		detailBounds.expandByScalar(0.12);
		cameraView([4, 8, 10].includes(selected[0]) ? "rear" : "front");
		onProgress(0);
		render();
	};
	setExercise(currentId);
	const clock = new Clock();
	let lastProgress = 0;
	const animate = () => {
		if (disposed) return;
		const delta = Math.min(clock.getDelta(), 0.05);
		if (!visible || document.hidden) return;
		if (playing) mixer.update(delta * 0.65);
		render();
		if (playing && clock.elapsedTime - lastProgress > 0.1) {
			onProgress((mixer.time % duration) / duration);
			lastProgress = clock.elapsedTime;
		}
	};
	function updateLoop() {
		if (disposed || !mixer) return;
		clock.start();
		renderer.setAnimationLoop(playing && visible && !document.hidden ? animate : null);
		render();
	}
	function contextLost(event: Event) {
		event.preventDefault();
		dispose();
		onUnavailable();
	}
	document.addEventListener("visibilitychange", updateLoop);
	renderer.domElement.addEventListener("webglcontextlost", contextLost);
	return {
		setExercise,
		setPlaying(value) {
			playing = value;
			updateLoop();
		},
		setProgress(value) {
			mixer.setTime(value * duration);
			onProgress(value);
			render();
		},
		setMuscles(value) {
			showMuscles = value;
			uniforms.highlight.value = showMuscles ? 1 : 0;
			render();
		},
		setCamera: cameraView,
		dispose,
	};
}
