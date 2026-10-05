import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as THREE from 'three';
const requireDependency = createRequire(import.meta.url);
const root = path.join(import.meta.dirname, '..');
function load(file, mocks = {}) {
  const compiledModule = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', js)(name => mocks[name] ?? (name === 'three' ? THREE : requireDependency(name)), compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const projection = load('src/components/planner/drag-projection.ts');
const { createDragProjection } = projection;
// A rightward finger movement must remain rightward on screen, regardless of orbit bearing.
for (const height of [1.55, 5, 10]) for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
  const camera = new THREE.PerspectiveCamera(42, 0.6, 0.1, 100);
  camera.position.set(Math.sin(angle) * 6, height, Math.cos(angle) * 6);
  camera.lookAt(0, 0.8, 0); camera.updateMatrixWorld();
  const grabbed = new THREE.Vector3(0, 0.8, 0);
  const origin = new THREE.Vector3(0, 0, 0);
  const screen = grabbed.clone().project(camera);
  const project = createDragProjection(origin, grabbed, new THREE.Vector3(0, 1, 0));
  for (const dx of [-0.1, 0.1, 0.2]) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(screen.x + dx, screen.y), camera);
    const result = project(raycaster.ray);
    assert(result); assert(Math.abs(result.y) < 1e-8);
    const surface = result.clone().add(grabbed).project(camera);
    assert(Math.abs(surface.x - screen.x - dx) < 1e-7);
  }
}
// Wall dragging preserves depth, and unstable/behind-camera rays retain the last valid position.
const wall = createDragProjection(new THREE.Vector3(0, 1, -2), new THREE.Vector3(0, 1, -1.98), new THREE.Vector3(0, 0, 1));
assert(Math.abs(wall(new THREE.Ray(new THREE.Vector3(1, 2, 3), new THREE.Vector3(0, 0, -1))).z + 2) < 1e-8);
assert.equal(wall(new THREE.Ray(new THREE.Vector3(0, 0, 3), new THREE.Vector3(1, 0, 0))), null);
assert.equal(wall(new THREE.Ray(new THREE.Vector3(0, 0, 3), new THREE.Vector3(0, 0, 1))), null);
let frame; const controls = { enabled: true }; let invalidations = 0;
const { useObjectDrag } = load('src/components/planner/use-object-drag.ts', {
  react: { useRef: value => ({ current: value }) },
  '@react-three/fiber': {
    useThree: select => select({ invalidate: () => invalidations++, get: () => ({ controls }) }),
    useFrame: fn => { frame = fn; },
  },
  './drag-projection': projection,
});
const captures = new Set(); let commits = []; let selections = 0;
const capture = { setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id) };
// The harness supplies useRef/useFrame/useThree stubs to exercise pointer sessions without WebGL.
// eslint-disable-next-line react-hooks/rules-of-hooks
const drag = useObjectDrag({ enabled: true, position: [0, 0, 0], normal: new THREE.Vector3(0, 1, 0), clamp: p => p.map((v, i) => i === 1 ? 0 : Math.max(-2, Math.min(2, v))), onSelect: () => selections++, onMove: p => commits.push(p), onDraggingChange: active => { controls.enabled = !active; } });
drag.ref.current = new THREE.Group();
function event(id, x) { return { pointerId: id, button: 0, target: capture, point: new THREE.Vector3(0, 0.8, 0), ray: new THREE.Ray(new THREE.Vector3(x, 4, 0), new THREE.Vector3(0, -1, 0)), stopPropagation() {}, nativeEvent: { target: { setPointerCapture() { throw Error('Native capture must not be used'); } } } }; }
drag.onPointerDown(event(1, 0)); assert(captures.has(1)); assert.equal(controls.enabled, false);
drag.onPointerMove(event(2, -2)); frame(null, 1 / 60); assert.equal(drag.ref.current.position.x, 0);
drag.onPointerMove(event(1, 1)); frame(null, 1 / 60); assert(drag.ref.current.position.x > 0 && drag.ref.current.position.x < 1);
for (let i = 0; i < 20; i++) frame(null, 1 / 60);
assert(Math.abs(drag.ref.current.position.x - 1) < 0.001);
drag.onPointerUp(event(2, 0)); assert(captures.has(1));
drag.onPointerUp(event(1, 1)); assert.deepEqual(commits, [[1, 0, 0]]); assert.equal(captures.size, 0); assert.equal(controls.enabled, true);
// Cancel restores the starting position, without adding an undo entry.
drag.onPointerDown(event(3, 0)); drag.onPointerMove(event(3, -2)); frame(null, 1 / 60); drag.onPointerCancel(event(3, -2));
assert.equal(drag.ref.current.position.x, 0); assert.equal(commits.length, 1); assert.equal(controls.enabled, true);
assert.equal(selections, 2); assert(invalidations > 0);
console.log('Drag checks passed: 24 camera poses, both directions, wall depth, horizon guards, Fiber capture, pointer ownership, smoothing, release and cancel.');
