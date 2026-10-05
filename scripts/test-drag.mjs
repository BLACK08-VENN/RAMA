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
let frame; const effects = []; const listeners = new Map();
const canvas = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
const controls = { enabled: true }; let invalidations = 0;
const { useObjectDrag } = load('src/components/planner/use-object-drag.ts', {
  react: { useRef: value => ({ current: value }), useEffect: fn => effects.push(fn) },
  '@react-three/fiber': {
    useThree: select => select({ gl: { domElement: canvas }, invalidate: () => invalidations++, get: () => ({ controls }) }),
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

const { createWallDragProjection, isWallVisible } = load('src/components/planner/wall-drag.ts');
const room = { width: 6, depth: 5, height: 3 };
const cameraInside = new THREE.Vector3(0, 1.5, 0);
const faces = { back: [0, 1.5, -2.475], right: [2.975, 1.5, 0], front: [0, 1.5, 2.475], left: [-2.975, 1.5, 0] };
for (const startWall of Object.keys(faces)) {
  const origin = new THREE.Vector3(...faces[startWall]);
  const project = createWallDragProjection(room, startWall, origin, origin, cameraInside);
  for (const targetWall of Object.keys(faces)) {
    const target = new THREE.Vector3(...faces[targetWall]);
    const result = project(new THREE.Ray(cameraInside, target.clone().sub(cameraInside).normalize()));
    assert.equal(result.wall, targetWall);
    assert(result.position.distanceTo(target) < 1e-7);
  }
}
// Skip the cutaway foreground wall, so a gesture reaches the wall visible behind it.
const outside = new THREE.Vector3(0, 1.5, 7);
const back = new THREE.Vector3(...faces.back);
const outsideProject = createWallDragProjection(room, 'back', back, back, outside);
assert.equal(isWallVisible(room, 'front', outside), false);
assert.equal(outsideProject(new THREE.Ray(outside, back.clone().sub(outside).normalize())).wall, 'back');
// Save wall, orientation and clamped position in one history entry, then undo/redo it.
const presets = load('src/data/room-presets.ts');
const storeModule = load('src/stores/planner-store.ts', {
  '@/data/products': { productById: { mirror: { decor: { mount: 'wall', width: 0.8, height: 0.8 } } } },
  '@/data/room-presets': presets,
  'zustand/middleware': { persist: fn => fn },
});
const store = storeModule.usePlannerStore;
const design = { ...store.getState().design, room: { ...store.getState().design.room, ...room }, items: [{ id: 'mirror', productId: 'mirror', kind: 'mirror', wall: 'back', position: faces.back, rotation: [0, 0, 0] }] };
store.getState().loadDesign(design);
store.getState().moveItem('mirror', [2.975, 1.5, 0.4], 'right');
assert.equal(store.getState().design.items[0].wall, 'right');
assert.equal(store.getState().design.items[0].rotation[1], -Math.PI / 2);
assert.equal(store.getState().design.items[0].position[2], 0.4);
assert.equal(store.getState().history.length, 1);
store.getState().undo(); assert.equal(store.getState().design.items[0].wall, 'back');
store.getState().redo(); assert.equal(store.getState().design.items[0].wall, 'right');
const encoded = storeModule.encodeSharedDesign(store.getState().design);
assert.equal(storeModule.decodeSharedDesign(encoded).items[0].wall, 'right');
console.log('Wall checks passed: all 16 wall pairs, cutaway visibility, atomic save, undo/redo and sharing.');

const snapshots = load('src/lib/saved-rooms.ts', { '@/stores/planner-store': storeModule });
const stored = new Map();
const storage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
assert.deepEqual(snapshots.readSavedRooms(storage), []);
let saved = snapshots.saveRoomSnapshot(storage, store.getState().design);
assert.equal(saved.length, 1);
assert.equal(storeModule.decodeSharedDesign(saved[0].payload).items[0].wall, 'right');
store.getState().moveItem('mirror', [2.975, 1.7, 0.6], 'right');
saved = snapshots.saveRoomSnapshot(storage, store.getState().design);
assert.equal(saved.length, 1); assert.equal(storeModule.decodeSharedDesign(saved[0].payload).items[0].position[1], 1.7);
saved = snapshots.saveRoomSnapshot(storage, { ...store.getState().design, title: 'Another room' });
assert.equal(saved.length, 2);
const restored = snapshots.readSavedRooms(storage);
assert.equal(restored.length, 2); assert.equal(restored[0].title, 'Another room');
assert.equal(snapshots.deleteRoomSnapshot(storage, restored[0].id).length, 1);
assert.throws(() => snapshots.saveRoomSnapshot({ getItem: () => null, setItem: () => { throw Error('Quota exceeded'); } }, store.getState().design));
assert.deepEqual(snapshots.readSavedRooms({ getItem: () => '{broken', setItem() {} }), []);
const { decorProducts } = load('src/data/decor-catalog.ts');
assert.equal(decorProducts.length, 38); assert.equal(new Set(decorProducts.map(p => p.id)).size, 38);
for (const product of decorProducts) { assert(product.decorative && product.decor); assert(fs.existsSync(path.join(root, 'public', product.image))); }
console.log('Save checks passed: restore, update, separate named rooms, deletion and storage failures. All 38 décor items have thumbnails.');

// A fresh template must never inherit items, a selection, or undo history from the previous room.
for (const preset of presets.roomPresets) {
  store.getState().loadDesign({ ...design, title: 'Decorated room to keep' });
  store.getState().addItem({ ...design.items[0], id: 'another-mirror' });
  const before = store.getState().design;
  const copies = snapshots.saveRoomSnapshot(storage, before);
  const savedBefore = copies.find(copy => copy.title === before.title);
  store.getState().applyRoomPreset(preset.id);
  const after = store.getState();
  assert.equal(after.design.room.presetId, preset.id);
  assert.equal(after.design.title, preset.name);
  assert.deepEqual(after.design.items, []);
  assert.equal(after.selectedId, null);
  assert.equal(after.history.length, 0); assert.equal(after.future.length, 0);
  after.undo(); assert.deepEqual(store.getState().design.items, []);
  const previous = storeModule.decodeSharedDesign(savedBefore.payload);
  assert.equal(previous.items.length, 2);
  store.getState().loadDesign(previous);
  assert.equal(store.getState().design.items.length, 2);
}
console.log(`Room switch checks passed: all ${presets.roomPresets.length} templates start empty, selection/history reset, saved décor restores.`);


const cleanups = effects.map(effect => effect()).filter(Boolean);
drag.onPointerDown(event(99, 0));
drag.onPointerMove(event(99, 1));
listeners.get('lostpointercapture')({ pointerId: 98 });
assert.equal(controls.enabled, false);
listeners.get('lostpointercapture')({ pointerId: 99 });
assert.equal(controls.enabled, true);
assert.equal(captures.size, 0);
drag.onPointerDown(event(100, 0));
cleanups.forEach(cleanup => cleanup());
assert.equal(controls.enabled, true);
assert.equal(captures.size, 0);
console.log('Lost capture and unmount restore camera controls');

const bedroom = { ...store.getState().design.room, roomType: 'bedroom', builtInStorage: { enabled: true, width: 2, rotation: 270, position: [1, 1] } };
const rotatedStorage = storeModule.getRotatedStorage(bedroom, 45);
assert.equal(rotatedStorage.rotation, 315);
assert.equal(storeModule.getRotatedStorage({ ...bedroom, builtInStorage: rotatedStorage }, 45).rotation, 0);
assert.equal(storeModule.getRotatedStorage(bedroom, -315).rotation, 315);
assert.deepEqual(rotatedStorage.position, storeModule.getStoragePlacement({ ...bedroom, builtInStorage: rotatedStorage }, [1, 1]));
console.log('Drawer rotation wraps angles and keeps rotated storage inside the room');
