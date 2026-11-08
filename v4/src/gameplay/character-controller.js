/**
 * V4 — Third-person character controller.
 *
 * Owns the player avatar: input → desired velocity → gravity → physics →
 * transform → animator conditions.
 *
 * The controller drives the body itself (`physics.moveBody`) instead of
 * letting the physics world integrate it, so the movement rules (acceleration,
 * jump, ground check) live in one readable place.
 *
 * Note on animator conditions: the animator's transition table is written
 * with both positive and negative condition names (`moving` / `!moving`), so
 * the controller publishes both. Setting only the positive half would leave
 * every "stop moving" transition permanently false.
 */

import { Tags } from '../core/ecs.js';
import { setPosition, setRotation } from '../core/transform.js';

const DEFAULT_CONFIG = {
  speed: 5,
  sprint: 9,
  jump: 6,
  radius: 0.4,
  height: 1.8,
  acceleration: 14,
  airControl: 0.45,
  friction: 12,
  gravity: null,     // null → take it from the physics world
  maxFallSpeed: 40,
};

/**
 * @param {object} opts
 * @param {object} opts.world     the ECS world
 * @param {object} opts.physics   the physics world
 * @param {object} [opts.input]   the input abstraction
 * @param {object} [opts.animator] the animator to drive
 * @param {object} [opts.bus]     the event bus
 * @param {object} [opts.entityId] the player entity
 * @param {object} [opts.camera]  a THREE camera (its yaw steers the movement)
 */
export function createCharacterController({
  world = null,
  physics = null,
  input = null,
  animator = null,
  bus = null,
  logger = null,
  entityId = null,
  camera = null,
  config = {},
} = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let yaw = 0;
  let airborne = false;
  let justLanded = false;
  let resolvedEntityId = typeof entityId === 'number' ? entityId : null;
  /**
   * Scratch vector for the camera's world direction.
   *
   * `Camera.getWorldDirection(target)` calls `target.set(...)`, then
   * `normalize()`, then `negate()` — a camera looks down its own -Z axis, so
   * three.js flips the axis. The stub implements exactly that chain and
   * nothing more, so this module stays free of a Three.js import and can be
   * tested in plain Node.
   */
  const cameraDirection = {
    x: 0, y: 0, z: 0,
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; },
    normalize() {
      const len = Math.hypot(this.x, this.y, this.z) || 1;
      this.x /= len; this.y /= len; this.z /= len;
      return this;
    },
    negate() { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; },
  };

  const velocity = { x: 0, y: 0, z: 0 };
  const state = {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    grounded: false,
    moving: false,
    sprinting: false,
    jumping: false,
    facing: 0,
  };

  /**
   * The entity the controller drives. When no id was given the player entity
   * is looked up in the world, so the controller can be created before the
   * level is built.
   */
  function targetId() {
    if (typeof resolvedEntityId === 'number') {
      const entity = world?.get?.(resolvedEntityId);
      if (entity) return resolvedEntityId;
    }
    const found = world?.query?.(Tags.PLAYER)?.[0] ?? null;
    if (found) resolvedEntityId = found.id;
    return resolvedEntityId;
  }

  function body() {
    const id = targetId();
    if (typeof id !== 'number') return null;
    return physics?.getBody?.(id) ?? null;
  }

  function transform() {
    const id = targetId();
    if (typeof id !== 'number') return null;
    return world?.getComponent?.(id, 'transform') ?? null;
  }

  /** Set the movement heading used when there is no camera to follow. */
  function setYaw(value) { yaw = value; }

  /**
   * Read the input axes and produce a normalised movement direction.
   *
   * Movement is camera-relative: "forward" is the direction the camera is
   * looking. The heading is taken from the camera's *world direction* rather
   * than from `camera.rotation.y`, because an Object3D's Euler angles are
   * ambiguous for a camera that is pitched — the Y angle alone does not say
   * where the camera is looking.
   */
  function readDirection() {
    if (!input) return { x: 0, z: 0, amount: 0 };
    const forward = input.axis('player.back', 'player.forward');
    const strafe = input.axis('player.left', 'player.right');
    const amount = Math.hypot(forward, strafe);
    if (amount === 0) return { x: 0, z: 0, amount: 0 };

    let fx = -Math.sin(yaw);
    let fz = -Math.cos(yaw);
    if (camera?.getWorldDirection) {
      camera.getWorldDirection(cameraDirection);
      const len = Math.hypot(cameraDirection.x, cameraDirection.z);
      if (len > 1e-4) {
        fx = cameraDirection.x / len;
        fz = cameraDirection.z / len;
      }
    }
    // Right is the forward direction turned 90° to the right (Y up).
    const rx = -fz;
    const rz = fx;

    let x = fx * forward + rx * strafe;
    let z = fz * forward + rz * strafe;
    const len = Math.hypot(x, z) || 1;
    x /= len;
    z /= len;
    return { x, z, amount: Math.min(1, amount) };
  }

  function setCondition(name, value) {
    animator?.setCondition?.(name, value);
  }

  /**
   * Advance the character by one frame.
   * @param {number} dt
   */
  function update(dt) {
    const b = body();
    if (!b) return state;
    const step = Math.max(0, dt);

    const direction = readDirection();
    const sprinting = !!(input?.isDown?.('player.sprint') && direction.amount > 0);
    const targetSpeed = sprinting ? cfg.sprint : cfg.speed;
    const desiredX = direction.x * targetSpeed * direction.amount;
    const desiredZ = direction.z * targetSpeed * direction.amount;

    const grounded = physics.grounded(b);

    // Jump — only from the ground, and only on the frame the key was pressed.
    if (input?.wasPressed?.('player.jump') && grounded) {
      velocity.y = cfg.jump;
      airborne = true;
    }

    // Horizontal acceleration (reduced in the air).
    const control = grounded ? 1 : cfg.airControl;
    const k = 1 - Math.exp(-cfg.acceleration * control * step);
    velocity.x += (desiredX - velocity.x) * k;
    velocity.z += (desiredZ - velocity.z) * k;

    if (grounded && direction.amount === 0) {
      const friction = 1 - Math.exp(-cfg.friction * step);
      velocity.x -= velocity.x * friction;
      velocity.z -= velocity.z * friction;
    }

    // Gravity.
    const gravity = cfg.gravity ?? physics.gravity ?? -24;
    if (!grounded || velocity.y > 0) {
      velocity.y += gravity * step;
      if (velocity.y < -cfg.maxFallSpeed) velocity.y = -cfg.maxFallSpeed;
    }

    // Move.
    const delta = { x: velocity.x * step, y: velocity.y * step, z: velocity.z * step };
    physics.moveBody(targetId(), delta);
    const nowGrounded = physics.grounded(b);

    justLanded = false;
    if (!grounded && nowGrounded) {
      justLanded = true;
      velocity.y = 0;
      airborne = false;
    } else if (nowGrounded) {
      airborne = false;
    } else {
      airborne = true;
    }

    // Face the direction of travel.
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    const moving = horizontalSpeed > 0.15;
    if (moving) {
      const facing = Math.atan2(velocity.x, velocity.z);
      state.facing = facing;
      const t = transform();
      if (t) setRotation(t, 0, facing, 0);
    }

    // Sync the transform with the physics body.
    const t = transform();
    if (t) setPosition(t, b.position.x, b.position.y, b.position.z);

    state.position = { x: b.position.x, y: b.position.y, z: b.position.z };
    state.velocity = { x: velocity.x, y: velocity.y, z: velocity.z };
    state.grounded = nowGrounded;
    state.moving = moving;
    state.sprinting = sprinting;
    state.jumping = airborne;

    // Animator conditions (positive and negative halves).
    setCondition('moving', moving);
    setCondition('!moving', !moving);
    setCondition('sprinting', sprinting);
    setCondition('!sprinting', !sprinting);
    setCondition('jumping', airborne);
    setCondition('landed', justLanded);

    if (justLanded && bus) {
      bus.emit('gameplay:landed', { entityId: targetId(), position: { ...state.position } });
    }
    return state;
  }

  return {
    /** The live controller state (position, velocity, grounded, ...). */
    get state() { return state; },
    /** The horizontal velocity, exposed for combat (facing checks). */
    get velocity() { return velocity; },
    /** True on the frame the character touched the ground after a fall. */
    get justLanded() { return justLanded; },
    /** The character's heading in radians. */
    get facing() { return state.facing; },
    config: cfg,

    /** The entity the controller drives. */
    get entityId() { return targetId(); },
    /** Attach (or replace) the animator this controller drives. */
    setAnimator(next) { animator = next; },
    /** Attach the camera whose yaw steers the movement. */
    setCamera(next) { camera = next; },
    /** Override the heading used when there is no camera. */
    setYaw,

    /** Teleport the character (and its body). */
    teleport(x, y, z) {
      const b = body();
      if (b) {
        b.position.x = x; b.position.y = y; b.position.z = z;
        b.velocity.x = 0; b.velocity.y = 0; b.velocity.z = 0;
      }
      velocity.x = 0; velocity.y = 0; velocity.z = 0;
      const t = transform();
      if (t) setPosition(t, x, y, z);
      state.position = { x, y, z };
      return state;
    },

    /** Advance the character. */
    update,
  };
}
