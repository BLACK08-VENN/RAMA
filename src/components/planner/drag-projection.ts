import * as THREE from "three";

/** Keep the grabbed surface under the pointer, even when the camera is close to eye level. */
export function createDragProjection(origin: THREE.Vector3, grabbed: THREE.Vector3, normal: THREE.Vector3) {
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, grabbed);
  const offset = origin.clone().sub(grabbed);
  const hit = new THREE.Vector3();
  return (ray: THREE.Ray): THREE.Vector3 | null => {
    // Near-parallel rays become unstable at the horizon; retain the last valid position.
    if (Math.abs(ray.direction.dot(plane.normal)) < 0.015) return null;
    if (!ray.intersectPlane(plane, hit)) return null;
    return hit.clone().add(offset);
  };
}
