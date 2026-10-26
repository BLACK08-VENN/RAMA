"use client";

import type { UploadedTrialModel } from "./trial-model-storage";
import { verifyGlb } from "./trial-model-storage";

/** Run only on user upload; the GLTF parser is dynamically imported, not bundled into first paint. */
export async function inspectUploadedTrialGlb(file: File): Promise<UploadedTrialModel> {
  if (!file.name.toLowerCase().endsWith(".glb") || !(await verifyGlb(file))) {
    throw new Error("Choose a valid .glb file (GLB 2.0, maximum 100 MB).");
  }

  const [{ GLTFLoader }, THREE] = await Promise.all([
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three"),
  ]);
  let gltf;
  try {
    gltf = await new GLTFLoader().parseAsync(await file.arrayBuffer(), "");
  } catch {
    throw new Error("This GLB could not be opened. Check that it contains a complete model and supported textures.");
  }
  const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
  // Inspection creates temporary decoded geometries/textures just to measure
  // the upload. Release them immediately: the real model loads separately
  // when placed in the room, from the retained original GLB blob.
  const disposedTextures = new Set<THREE.Texture>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposedGeometry = new Set<THREE.BufferGeometry>();
  gltf.scene.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry && !disposedGeometry.has(mesh.geometry)) {
      disposedGeometry.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material || disposedMaterials.has(material)) continue;
      disposedMaterials.add(material);
      for (const candidate of Object.values(material)) {
        if (!(candidate instanceof THREE.Texture) || disposedTextures.has(candidate)) continue;
        disposedTextures.add(candidate);
        const image = candidate.image as { close?: () => void } | undefined;
        candidate.dispose();
        image?.close?.();
      }
      material.dispose();
    }
  });
  if (![size.x, size.y, size.z].every(value => Number.isFinite(value) && value > 0.00001)) {
    throw new Error("The GLB does not contain measurable 3D geometry.");
  }

  const title = file.name.replace(/\.glb$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "New furniture";
  const lower = title.toLowerCase();
  const kind: UploadedTrialModel["kind"] =
    /sofa|couch|loveseat|sectional|settee/.test(lower) ? "sofa" :
    /table|desk|counter/.test(lower) ? "table" :
    /bed|mattress/.test(lower) ? "bed" :
    /cabinet|wardrobe|shelf|dresser|sideboard|cupboard/.test(lower) ? "cabinet" : "chair";

  // Normalize the model uniformly, preserving its proportions. Some exporters
  // orient long tables/sofas along local Z rather than along room width.
  const rotate = (kind === "table" || kind === "sofa" || kind === "bed") && size.z > size.x * 1.15;
  const naturalWidth = rotate ? size.z : size.x;
  const naturalDepth = rotate ? size.x : size.z;
  const recommendedHeight = { chair: 1.05, sofa: .90, table: .77, bed: .80, cabinet: 1.75 }[kind];
  const widthLimit = { chair: 1.4, sofa: 2.9, table: 3.4, bed: 2.3, cabinet: 2.0 }[kind];
  const depthLimit = { chair: 1.2, sofa: 1.5, table: 1.8, bed: 2.5, cabinet: 1.3 }[kind];
  const scale = Math.min(recommendedHeight / size.y, widthLimit / naturalWidth, depthLimit / naturalDepth);
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("Invalid GLB dimensions");

  // Generated identifiers are stable after upload and harmless in saved designs.
  return {
    id: `trial-upload-${crypto.randomUUID()}`,
    name: title + " · trial",
    kind,
    width: Math.max(.10, Math.round(naturalWidth * scale * 1000) / 1000),
    depth: Math.max(.10, Math.round(naturalDepth * scale * 1000) / 1000),
    height: Math.max(.10, Math.round(size.y * scale * 1000) / 1000),
    rotated: rotate,
    fileName: file.name.slice(0, 160),
    createdAt: Date.now(),
  };
}
