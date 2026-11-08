/**
 * Transform unit tests — matrix composition, the parent hierarchy and dirty
 * propagation.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  composeMatrix,
  createTransform,
  isNearlyEqual,
  markDirty,
  multiplyMatrices,
  setPosition,
  setRotation,
  setScale,
  translationOf,
  updateWorldMatrices,
  worldPosition,
} from '../src/core/transform.js';

test('composeMatrix builds an identity for the default transform', () => {
  const matrix = composeMatrix([0, 0, 0], [0, 0, 0], [1, 1, 1]);
  assert.equal(matrix.length, 16);
  assert.equal(matrix[0], 1);
  assert.equal(matrix[5], 1);
  assert.equal(matrix[10], 1);
  assert.equal(matrix[15], 1);
  assert.deepEqual(translationOf(matrix), [0, 0, 0]);
});

test('composeMatrix applies translation, rotation and scale', () => {
  const matrix = composeMatrix([1, 2, 3], [0, 0, 0], [2, 2, 2]);
  assert.deepEqual(translationOf(matrix), [1, 2, 3]);
  assert.equal(matrix[0], 2);
  assert.equal(matrix[5], 2);
  assert.equal(matrix[10], 2);
});

test('a quarter turn about Y moves the X axis onto the Z axis', () => {
  const matrix = composeMatrix([0, 0, 0], [0, Math.PI / 2, 0], [1, 1, 1]);
  // Column-major: element 0 is the world X basis vector.
  assert.ok(isNearlyEqual(matrix[0], 0, 1e-6));
  assert.ok(isNearlyEqual(matrix[2], -1, 1e-6));
});

test('multiplyMatrices composes translation', () => {
  const a = composeMatrix([10, 0, 0], [0, 0, 0], [1, 1, 1]);
  const b = composeMatrix([0, 5, 0], [0, 0, 0], [1, 1, 1]);
  const product = multiplyMatrices(a, b);
  assert.deepEqual(translationOf(product), [10, 5, 0]);
});

test('a child inherits its parent world transform', () => {
  const parent = createTransform({ position: [10, 0, 0] });
  const child = createTransform({ position: [0, 5, 0] });
  parent.children = [child];

  updateWorldMatrices(parent);

  assert.deepEqual(worldPosition(parent), [10, 0, 0]);
  assert.deepEqual(worldPosition(child), [10, 5, 0]);
});

test('a three-level hierarchy composes', () => {
  const a = createTransform({ position: [1, 0, 0] });
  const b = createTransform({ position: [0, 2, 0] });
  const c = createTransform({ position: [0, 0, 3] });
  a.children = [b];
  b.children = [c];

  updateWorldMatrices(a);

  assert.deepEqual(worldPosition(b), [1, 2, 0]);
  assert.deepEqual(worldPosition(c), [1, 2, 3]);
});

test('the world matrix is only recomputed when the transform is dirty', () => {
  const t = createTransform({ position: [1, 1, 1] });
  updateWorldMatrices(t);
  assert.equal(t.dirty, false);

  setPosition(t, 2, 2, 2);
  assert.equal(t.dirty, true);
  updateWorldMatrices(t);
  assert.equal(t.dirty, false);
  assert.deepEqual(worldPosition(t), [2, 2, 2]);
});

test('a change on the parent marks the whole subtree dirty', () => {
  const parent = createTransform({ position: [0, 0, 0] });
  const child = createTransform({ position: [0, 0, 0] });
  const grandchild = createTransform({ position: [0, 0, 0] });
  parent.children = [child];
  child.children = [grandchild];

  updateWorldMatrices(parent);
  assert.equal(child.dirty, false);
  assert.equal(grandchild.dirty, false);

  setPosition(parent, 5, 0, 0);
  assert.equal(parent.dirty, true);
  assert.equal(child.dirty, true);
  assert.equal(grandchild.dirty, true);
});

test('markDirty tolerates a missing transform', () => {
  assert.doesNotThrow(() => markDirty(null));
});

test('setRotation and setScale mark the transform dirty and are applied', () => {
  const t = createTransform();
  setRotation(t, 0, Math.PI / 2, 0);
  setScale(t, 2, 2, 2);
  assert.equal(t.dirty, true);

  updateWorldMatrices(t);
  assert.deepEqual(t.rotation, [0, Math.PI / 2, 0]);
  assert.deepEqual(t.scale, [2, 2, 2]);
  assert.equal(t.local[0], 0);
});

test('isNearlyEqual compares with a tolerance', () => {
  assert.equal(isNearlyEqual(1, 1 + 1e-9), true);
  assert.equal(isNearlyEqual(1, 1.1), false);
});
