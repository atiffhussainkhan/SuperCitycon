/**
 * V4 — Transform hierarchy.
 *
 * Local transform (position / euler rotation / scale) plus a parent link, so
 * the editor's hierarchy panel, the runtime's character rig and the save
 * format all describe the same thing. World matrices are computed lazily and
 * marked dirty when a local value or a parent link changes.
 */

const EPS = 1e-6;

export function createTransform({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  parent = null,
  children = [],
} = {}) {
  return {
    position: [...position],
    rotation: [...rotation],
    scale: [...scale],
    parent,
    children: [...children],
    dirty: true,
    /** Local matrix, recomputed when dirty. Stored as a 16-element column-major array. */
    local: new Array(16).fill(0),
    /** World matrix (parent * local). */
    world: new Array(16).fill(0),
  };
}

export function markDirty(transform) {
  if (!transform) return;
  transform.dirty = true;
  for (const child of transform.children ?? []) {
    // The child transform is owned by its entity; the world recomputes lazily,
    // so we only need to note that its parent changed.
    if (child && typeof child === 'object') markDirty(child);
  }
}

/**
 * Remove floating-point dust from a matrix element.
 *
 * A rotation of exactly a quarter turn produces cos(π/2) = 6.1e-17 rather
 * than 0, and that dust leaks into equality checks and into the editor's
 * "is this transform changed?" comparison. Anything below 1e-12 is noise at
 * the scale a transform matrix operates on, so it is snapped to an exact zero
 * (and -0 is normalised to +0, which `deepStrictEqual` treats as different).
 */
const DUST = 1e-12;
function snap(value) {
  if (!Number.isFinite(value)) return value;
  if (Math.abs(value) < DUST) return 0;
  return Object.is(value, -0) ? 0 : value;
}

/**
 * Compute a column-major 4x4 matrix from position, euler XYZ rotation and
 * scale, without pulling in a matrix library for the data model.
 */
export function composeMatrix(position, rotation, scale) {
  const [rx, ry, rz] = rotation;
  const cx = Math.cos(rx); const sx = Math.sin(rx);
  const cy = Math.cos(ry); const sy = Math.sin(ry);
  const cz = Math.cos(rz); const sz = Math.sin(rz);
  // R = Rx * Ry * Rz applied to a column vector — the same composite as
  // three.js's Euler order 'XYZ' (roll first, then pitch, then yaw), which
  // is the convention the editor's gizmo writes back.
  const m00 = cy * cz;
  const m01 = -cy * sz;
  const m02 = sy;
  const m10 = sx * sy * cz + cx * sz;
  const m11 = -sx * sy * sz + cx * cz;
  const m12 = -sx * cy;
  const m20 = -cx * sy * cz + sx * sz;
  const m21 = cx * sy * sz + sx * cz;
  const m22 = cx * cy;
  const [px, py, pz] = position;
  const [sX, sY, sZ] = scale;
  return [
    m00 * sX, m10 * sX, m20 * sX, 0,
    m01 * sY, m11 * sY, m21 * sY, 0,
    m02 * sZ, m12 * sZ, m22 * sZ, 0,
    px, py, pz, 1,
  ].map(snap);
}

/** Multiply two column-major 4x4 matrices: a * b. */
export function multiplyMatrices(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = snap(sum);
    }
  }
  return out;
}

/** Extract the translation (x, y, z) from a column-major matrix. */
export function translationOf(matrix) {
  return [matrix[12], matrix[13], matrix[14]];
}

/** Recursively compute world matrices for a transform tree. */
export function updateWorldMatrices(transform, parentWorld = null) {
  if (!transform) return;
  if (transform.dirty) {
    transform.local = composeMatrix(transform.position, transform.rotation, transform.scale);
    transform.dirty = false;
  }
  transform.world = parentWorld ? multiplyMatrices(parentWorld, transform.local) : [...transform.local];
  for (const child of transform.children ?? []) updateWorldMatrices(child, transform.world);
}

/** Set the local position, marking the transform (and its subtree) dirty. */
export function setPosition(transform, x, y, z) {
  transform.position = [x, y, z];
  markDirty(transform);
}

/** Set the local rotation in radians (XYZ euler), marking the transform dirty. */
export function setRotation(transform, x, y, z) {
  transform.rotation = [x, y, z];
  markDirty(transform);
}

/** Set the local scale, marking the transform dirty. */
export function setScale(transform, x, y, z) {
  transform.scale = [x, y, z];
  markDirty(transform);
}

/** The transform's world-space position, computed from the cached world matrix. */
export function worldPosition(transform) {
  return translationOf(transform.world);
}

export function isNearlyEqual(a, b, eps = EPS) {
  return Math.abs(a - b) <= eps;
}
