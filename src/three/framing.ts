import { type Box3, MathUtils, Matrix4, Vector3 } from "three";

export type CameraView = "front" | "side" | "rear" | "detail";
export const FIELD_OF_VIEW = 34;

export function frameBounds(bounds: Box3, aspect: number, view: CameraView) {
	const target = bounds.getCenter(new Vector3());
	const direction = new Vector3(
		...((view === "side" ? [1, 0.08, 0.12] : view === "rear" ? [0.5, 0.1, -1] : [0.5, 0.1, 1]) as [
			number,
			number,
			number,
		]),
	).normalize();
	const rotation = new Matrix4().lookAt(direction, new Vector3(), new Vector3(0, 1, 0));
	const inverse = rotation.clone().invert();
	const tanY = Math.tan(MathUtils.degToRad(FIELD_OF_VIEW / 2));
	const tanX = tanY * Math.max(aspect, 0.1);
	let distance = 0;
	for (const x of [bounds.min.x, bounds.max.x])
		for (const y of [bounds.min.y, bounds.max.y])
			for (const z of [bounds.min.z, bounds.max.z]) {
				const corner = new Vector3(x, y, z).sub(target).applyMatrix4(inverse);
				distance = Math.max(
					distance,
					corner.z + Math.abs(corner.x) / tanX,
					corner.z + Math.abs(corner.y) / tanY,
				);
			}
	return {
		target,
		position: target.clone().addScaledVector(direction, Math.max(distance, 0.5) * 1.12),
	};
}
