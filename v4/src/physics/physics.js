/**
 * V4 — Physics integration.
 *
 * A compact, deterministic physics core: axis-aligned boxes and spheres with
 * gravity, a ground plane, resolution against static colliders (push-out
 * along the axis of least penetration) and a ray query for picking in the
 * editor. It is deliberately small — the simulation runs on a fixed step, so
 * the same inputs always produce the same result, which is what the
 * save/replay tests need.
 */

export function createPhysicsWorld({ gravity = -24, groundY = 0, bounds = 200 } = {}) {
  /** @type {Map<number, {entityId:number, shape:'box'|'sphere', halfExtents:[number,number,number], radius:number, position:{x,y,z}, velocity:{x,y,z}, mass:number, kinematic:boolean, onGround:boolean}>} */
  const bodies = new Map();
  const colliders = [];   // static geometry the world resolves against

  const physics = {
    gravity,
    groundY,
    bounds,

    addBody({ entityId, shape = 'box', halfExtents = [0.5, 0.5, 0.5], radius = 0.5, position = { x: 0, y: 0, z: 0 }, velocity = { x: 0, y: 0, z: 0 }, mass = 0, kinematic = false }) {
      const body = {
        entityId, shape, halfExtents: [...halfExtents], radius,
        position: { ...position }, velocity: { ...velocity },
        mass, kinematic, onGround: false, groundedFrames: 0,
      };
      bodies.set(entityId, body);
      return body;
    },

    removeBody(entityId) { return bodies.delete(entityId); },
    getBody(entityId) { return bodies.get(entityId) ?? null; },
    bodyCount() { return bodies.size; },

    /** A static collider (a box in world space). */
    addCollider({ min, max, name = 'collider' }) {
      const c = { min: { ...min }, max: { ...max }, name };
      colliders.push(c);
      return c;
    },
    clearColliders() { colliders.length = 0; },
    colliders() { return [...colliders]; },

    /**
     * Step the simulation. Kinematic bodies are not integrated — they are
     * driven by gameplay code (a character controller), and physics only
     * resolves them.
     */
    step(dt) {
      for (const body of bodies.values()) {
        if (body.kinematic) { body.onGround = physics.grounded(body); continue; }
        body.velocity.y += gravity * dt;
        body.position.x += body.velocity.x * dt;
        body.position.y += body.velocity.y * dt;
        body.position.z += body.velocity.z * dt;

        // Ground.
        const halfHeight = body.shape === 'sphere' ? body.radius : body.halfExtents[1];
        const hx = body.shape === 'sphere' ? body.radius : body.halfExtents[0];
        const hz = body.shape === 'sphere' ? body.radius : body.halfExtents[2];
        if (body.position.y - halfHeight <= groundY) {
          body.position.y = groundY + halfHeight;
          if (body.velocity.y < 0) body.velocity.y = 0;
          body.onGround = true;
          body.groundedFrames += 1;
        } else {
          body.onGround = false;
          body.groundedFrames = 0;
        }

        // Static colliders: push out along the axis of least penetration.
        for (const c of colliders) {
          if (body.position.x + hx < c.min.x || body.position.x - hx > c.max.x) continue;
          if (body.position.z + hz < c.min.z || body.position.z - hz > c.max.z) continue;
          if (body.position.y + halfHeight < c.min.y || body.position.y - halfHeight > c.max.y) continue;
          const overlapX = Math.min(c.max.x - (body.position.x - hx), (body.position.x + hx) - c.min.x);
          const overlapY = Math.min(c.max.y - (body.position.y - halfHeight), (body.position.y + halfHeight) - c.min.y);
          const overlapZ = Math.min(c.max.z - (body.position.z - hz), (body.position.z + hz) - c.min.z);
          if (overlapY <= overlapX && overlapY <= overlapZ) {
            body.position.y += (body.velocity.y > 0 ? -1 : 1) * overlapY;
            if (body.velocity.y < 0) { body.velocity.y = 0; body.onGround = true; }
          } else if (overlapX <= overlapZ) {
            body.position.x += (body.velocity.x > 0 ? -1 : 1) * overlapX;
            body.velocity.x = 0;
          } else {
            body.position.z += (body.velocity.z > 0 ? -1 : 1) * overlapZ;
            body.velocity.z = 0;
          }
        }

        // World bounds.
        body.position.x = Math.max(-bounds, Math.min(bounds, body.position.x));
        body.position.z = Math.max(-bounds, Math.min(bounds, body.position.z));
      }
    },

    /** Is the body resting on the ground or a collider? */
    grounded(body) {
      const halfHeight = body.shape === 'sphere' ? body.radius : body.halfExtents[1];
      if (body.position.y - halfHeight <= groundY + 0.001) return true;
      for (const c of colliders) {
        if (body.position.x + halfHeight < c.min.x || body.position.x - halfHeight > c.max.x) continue;
        if (body.position.z + halfHeight < c.min.z || body.position.z - halfHeight > c.max.z) continue;
        if (Math.abs(body.position.y - halfHeight - c.max.y) < 0.05) return true;
      }
      return false;
    },

    /**
     * Ray vs the static colliders and the ground. Returns the nearest hit.
     * Used by the editor to pick objects and by the NPC sight check.
     */
    raycast(origin, dir, maxDistance = 200) {
      let best = null;
      const test = (t, normal, kind, name) => {
        if (t < 0 || t > maxDistance) return;
        if (!best || t < best.distance) best = { distance: t, point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t }, normal, kind, name };
      };

      // Ground plane (y = groundY).
      if (dir.y !== 0) {
        const t = (groundY - origin.y) / dir.y;
        if (t > 0) test(t, { x: 0, y: 1, z: 0 }, 'ground', 'ground');
      }

      // Axis-aligned boxes: slab method.
      for (const c of colliders) {
        let tmin = 0;
        let tmax = maxDistance;
        let axis = -1;
        let sign = 1;
        const o = [origin.x, origin.y, origin.z];
        const d = [dir.x, dir.y, dir.z];
        const mn = [c.min.x, c.min.y, c.min.z];
        const mx = [c.max.x, c.max.y, c.max.z];
        let ok = true;
        for (let a = 0; a < 3; a += 1) {
          if (Math.abs(d[a]) < 1e-9) {
            if (o[a] < mn[a] || o[a] > mx[a]) { ok = false; break; }
            continue;
          }
          const inv = 1 / d[a];
          let t1 = (mn[a] - o[a]) * inv;
          let t2 = (mx[a] - o[a]) * inv;
          let s = -1;
          if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
          if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
          if (t2 < tmax) tmax = t2;
          if (tmin > tmax) { ok = false; break; }
        }
        if (ok && axis >= 0) {
          const n = { x: 0, y: 0, z: 0 };
          if (axis === 0) n.x = sign; else if (axis === 1) n.y = sign; else n.z = sign;
          test(tmin, n, 'collider', c.name);
        }
      }
      return best;
    },

    /** Move a body and resolve it — used by the character controller. */
    moveBody(entityId, delta, { stepHeight = 0.4 } = {}) {
      const body = bodies.get(entityId);
      if (!body) return null;
      const before = { ...body.position };
      body.position.x += delta.x;
      body.position.y += delta.y;
      body.position.z += delta.z;

      // The body's own extents per axis — a box is not a cube, and the old
      // code used the *vertical* half-extent for the horizontal tests too.
      const hx = body.shape === 'sphere' ? body.radius : body.halfExtents[0];
      const hy = body.shape === 'sphere' ? body.radius : body.halfExtents[1];
      const hz = body.shape === 'sphere' ? body.radius : body.halfExtents[2];

      if (body.position.y - hy < groundY) {
        body.position.y = groundY + hy;
        if (body.velocity.y < 0) body.velocity.y = 0;
        body.onGround = true;
      } else {
        body.onGround = false;
      }

      for (const c of colliders) {
        if (body.position.x + hx < c.min.x || body.position.x - hx > c.max.x) continue;
        if (body.position.z + hz < c.min.z || body.position.z - hz > c.max.z) continue;
        if (body.position.y + hy < c.min.y || body.position.y - hy > c.max.y) continue;

        const overlapX = Math.min(c.max.x - (body.position.x - hx), (body.position.x + hx) - c.min.x);
        const overlapY = Math.min(c.max.y - (body.position.y - hy), (body.position.y + hy) - c.min.y);
        const overlapZ = Math.min(c.max.z - (body.position.z - hz), (body.position.z + hz) - c.min.z);

        if (overlapY <= stepHeight) {
          // Low enough to step onto it: stand on top instead of being blocked.
          body.position.y = c.max.y + hy;
          if (body.velocity.y < 0) body.velocity.y = 0;
          body.onGround = true;
          continue;
        }

        // Too tall to step onto: push out horizontally, along the axis of
        // least penetration, so a character slides along a wall instead of
        // being stopped dead by its corner.
        //
        // "Least penetration" means the *nearest exit*: how far the body has
        // to travel to be completely outside the collider on that side.
        const exitXLeft = (body.position.x + hx) - c.min.x;
        const exitXRight = c.max.x - (body.position.x - hx);
        const exitZBack = (body.position.z + hz) - c.min.z;
        const exitZForward = c.max.z - (body.position.z - hz);
        const depthX = Math.min(exitXLeft, exitXRight);
        const depthZ = Math.min(exitZBack, exitZForward);
        if (depthX <= depthZ) {
          if (exitXLeft <= exitXRight) {
            body.position.x -= exitXLeft;
            if (delta.x > 0) body.velocity.x = 0;   // it was moving into the wall
          } else {
            body.position.x += exitXRight;
            if (delta.x < 0) body.velocity.x = 0;
          }
        } else {
          if (exitZBack <= exitZForward) {
            body.position.z -= exitZBack;
            if (delta.z > 0) body.velocity.z = 0;
          } else {
            body.position.z += exitZForward;
            if (delta.z < 0) body.velocity.z = 0;
          }
        }
      }

      body.position.x = Math.max(-bounds, Math.min(bounds, body.position.x));
      body.position.z = Math.max(-bounds, Math.min(bounds, body.position.z));
      return {
        moved: {
          x: body.position.x - before.x,
          y: body.position.y - before.y,
          z: body.position.z - before.z,
        },
        onGround: body.onGround,
      };
    },

    clear() { bodies.clear(); colliders.length = 0; },
  };
  return physics;
}
