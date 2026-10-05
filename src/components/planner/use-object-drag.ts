"use client";

import { useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { createDragProjection } from "./drag-projection";

type Position = [number, number, number];
export type PointerCaptureTarget = {
  setPointerCapture: (id: number) => void;
  hasPointerCapture: (id: number) => boolean;
  releasePointerCapture: (id: number) => void;
};

// Fiber supplies these methods on its synthetic target; its EventTarget type omits them.
export const pointerCaptureTarget = (event: ThreeEvent<PointerEvent>) => event.target as unknown as PointerCaptureTarget;

export function useObjectDrag({ enabled, position, normal, clamp, onSelect, onMove, onDraggingChange, createProjection, onPreview, onCancel, isVisible }: {
  enabled: boolean;
  position: Position;
  normal: THREE.Vector3;
  clamp: (position: Position) => Position;
  onSelect?: () => void;
  onMove: (position: Position) => void;
  onDraggingChange: (active: boolean) => void;
  createProjection?: (origin: THREE.Vector3, grabbed: THREE.Vector3) => ReturnType<typeof createDragProjection>;
  onPreview?: (group: THREE.Group, position: Position) => void;
  onCancel?: () => void;
  isVisible?: () => boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const invalidate = useThree(state => state.invalidate);
  const get = useThree(state => state.get);
  const session = useRef<{
    pointerId: number; capture: PointerCaptureTarget; start: Position; next: Position;
    project: ReturnType<typeof createDragProjection>;
  } | null>(null);

  useFrame((_, delta) => {
    if (group.current && isVisible) group.current.visible = isVisible();
    const active = session.current;
    if (!active || !group.current) return;
    onPreview?.(group.current, active.next);
    const target = new THREE.Vector3(...active.next);
    if (group.current.position.distanceToSquared(target) < 0.000001) {
      group.current.position.copy(target);
      return;
    }
    // Short, frame-rate independent easing filters touch jitter without overshooting.
    group.current.position.lerp(target, 1 - Math.exp(-40 * Math.min(delta, 0.1)));
    invalidate();
  });

  const finish = (event: ThreeEvent<PointerEvent>, commit: boolean) => {
    const active = session.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.stopPropagation();
    session.current = null;
    const next = commit ? active.next : active.start;
    if (!commit) onCancel?.();
    if (group.current) { group.current.position.set(...next); onPreview?.(group.current, next); }
    if (active.capture.hasPointerCapture(active.pointerId)) active.capture.releasePointerCapture(active.pointerId);
    if (commit && active.start.some((value, index) => Math.abs(value - next[index]) > 0.00001)) onMove(next);
    onDraggingChange(false);
    invalidate();
  };

  return {
    ref: group,
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      if (session.current || event.button !== 0) return;
      const controls = get().controls as { enabled: boolean } | null;
      if (controls && !controls.enabled) return;
      onSelect?.();
      if (!enabled) return;
      const start: Position = [...position];
      session.current = { pointerId: event.pointerId, capture: pointerCaptureTarget(event), start, next: start,
        project: createProjection ? createProjection(new THREE.Vector3(...start), event.point) : createDragProjection(new THREE.Vector3(...start), event.point, normal) };
      // Fiber capture routes moves to this object even after the finger leaves its mesh.
      pointerCaptureTarget(event).setPointerCapture(event.pointerId);
      onDraggingChange(true);
    },
    onPointerMove: (event: ThreeEvent<PointerEvent>) => {
      const active = session.current;
      if (!active || active.pointerId !== event.pointerId) return;
      event.stopPropagation();
      const point = active.project(event.ray);
      if (!point) return;
      active.next = clamp([point.x, point.y, point.z]);
      invalidate();
    },
    onPointerUp: (event: ThreeEvent<PointerEvent>) => finish(event, true),
    onPointerCancel: (event: ThreeEvent<PointerEvent>) => finish(event, false),
  };
}
