"use client";

import { useEffect, useRef } from "react";
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

// A press still counts as a tap while the pointer stays within a few pixels of where it
// landed, and touch users hold for a beat before the action menu opens.
const TAP_TOLERANCE = 6;
const LONG_PRESS_DELAY = 450;

export type TapPoint = { x: number; y: number };

type DragSession = {
  pointerId: number;
  capture: PointerCaptureTarget;
  start: Position;
  next: Position;
  project: ReturnType<typeof createDragProjection> | null;
  origin: { x: number; y: number };
  cancel: () => void;
  pressTimer?: number;
};

export function useObjectDrag({ enabled, position, normal, clamp, onSelect, onTap, onMove, onDraggingChange, createProjection, onPreview, onCancel, isVisible }: {
  enabled: boolean;
  position: Position;
  normal: THREE.Vector3;
  clamp: (position: Position) => Position;
  onSelect?: () => void;
  onTap?: (point: TapPoint) => void;
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
  const canvas = useThree(state => state.gl.domElement);
  const session = useRef<DragSession | null>(null);

  useEffect(() => {
    const cancel = () => session.current?.cancel();
    const lost = (event: PointerEvent) => { if (event.pointerId === session.current?.pointerId) cancel(); };
    const hidden = () => { if (document.hidden) cancel(); };
    canvas.addEventListener("lostpointercapture", lost);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancel();
      canvas.removeEventListener("lostpointercapture", lost);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [canvas]);

  useEffect(() => { if (!enabled) session.current?.cancel(); }, [enabled]);

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
    if (active.pressTimer) { window.clearTimeout(active.pressTimer); active.pressTimer = undefined; }
    session.current = null;
    const next = commit ? active.next : active.start;
    if (!commit) onCancel?.();
    if (group.current) { group.current.position.set(...next); onPreview?.(group.current, next); }
    try {
      if (active.capture.hasPointerCapture(active.pointerId)) active.capture.releasePointerCapture(active.pointerId);
    } catch { /* The browser may already have released capture. */ }
    if (commit && active.start.some((value, index) => Math.abs(value - next[index]) > 0.00001)) onMove(next);
    onDraggingChange(false);
    invalidate();
  };

  const travelled = (event: ThreeEvent<PointerEvent>, active: DragSession) => {
    const native = event.nativeEvent;
    return Math.hypot(native.clientX - active.origin.x, native.clientY - active.origin.y);
  };

  return {
    ref: group,
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      if (session.current || event.button !== 0) return;
      const controls = get().controls as { enabled: boolean } | null;
      if (controls && !controls.enabled) return;
      const native = event.nativeEvent;
      onSelect?.();
      const active: DragSession = {
        pointerId: event.pointerId,
        capture: pointerCaptureTarget(event),
        start: [...position],
        next: [...position],
        project: null,
        origin: { x: native.clientX, y: native.clientY },
        cancel: () => {
          if (session.current === active) finish(event, false);
        },
      };
      session.current = active;

      // Touch has no hover, so a plain tap is reserved for dragging and the action menu
      // waits for a deliberate hold instead.
      if (native.pointerType === "touch") {
        active.pressTimer = window.setTimeout(() => {
          if (session.current !== active) return;
          finish(event, false);
          onTap?.({ x: native.clientX, y: native.clientY });
        }, LONG_PRESS_DELAY);
      }

      if (!enabled) return;
      active.project = createProjection
        ? createProjection(new THREE.Vector3(...active.start), event.point)
        : createDragProjection(new THREE.Vector3(...active.start), event.point, normal);
      // Fiber capture routes moves to this object even after the finger leaves its mesh.
      try { pointerCaptureTarget(event).setPointerCapture(event.pointerId); }
      catch { session.current = null; return; }
      onDraggingChange(true);
    },
    onPointerMove: (event: ThreeEvent<PointerEvent>) => {
      const active = session.current;
      if (!active || active.pointerId !== event.pointerId) return;
      if (active.pressTimer && travelled(event, active) > TAP_TOLERANCE) {
        window.clearTimeout(active.pressTimer);
        active.pressTimer = undefined;
      }
      if (!active.project) return;
      event.stopPropagation();
      const point = active.project(event.ray);
      if (!point) return;
      active.next = clamp([point.x, point.y, point.z]);
      invalidate();
    },
    onPointerUp: (event: ThreeEvent<PointerEvent>) => {
      const active = session.current;
      if (!active || active.pointerId !== event.pointerId) return;
      const tapped = travelled(event, active) <= TAP_TOLERANCE;
      finish(event, true);
      if (tapped && event.nativeEvent.pointerType !== "touch") {
        onTap?.({ x: event.nativeEvent.clientX, y: event.nativeEvent.clientY });
      }
    },
    onPointerCancel: (event: ThreeEvent<PointerEvent>) => finish(event, false),
  };
}
