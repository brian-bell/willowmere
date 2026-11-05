// Grounded, camera-relative movement. Small swept steps keep the visitor out of
// furniture even during a slow frame; independent axes let them slide along it.
//
// A collider is a circle ({ x, z, r }), a box ({ x, z, w, d, rotation }), or a
// shape ({ blocks(x, z, clearance) }). A room may also give `rail(x, z)`, the line
// a walker on a ladder keeps to (src/windmill/layout.js): there the walking keys
// go along the line, up it when facing up it and down it when facing down it,
// at `pace` of a walk, and the walked distance counts rungs, not metres.
const SLIDE_TURNS = [0.4, -0.4, 0.8, -0.8, 1.2, -1.2];

export function createInteriorWalker({ bounds, colliders, spawn, rail }) {
  const radius = 0.24;
  const position = { x: spawn.x, z: spawn.z };
  const velocity = { x: 0, z: 0 };
  let yaw = spawn.yaw,
    pitch = -0.035,
    distance = 0;

  function blocked(x, z, clearance = radius) {
    if (
      x < bounds.minX + clearance ||
      x > bounds.maxX - clearance ||
      z < bounds.minZ + clearance ||
      z > bounds.maxZ - clearance
    )
      return true;
    return colliders.some((c) => {
      if (c.blocks) return c.blocks(x, z, clearance);
      if (c.r !== undefined)
        return Math.hypot(x - c.x, z - c.z) < c.r + clearance;
      const cos = Math.cos(c.rotation || 0),
        sin = Math.sin(c.rotation || 0);
      const u = (x - c.x) * cos - (z - c.z) * sin;
      const v = (x - c.x) * sin + (z - c.z) * cos;
      const dx = Math.max(Math.abs(u) - c.w / 2, 0);
      const dz = Math.max(Math.abs(v) - c.d / 2, 0);
      return dx * dx + dz * dz < clearance * clearance;
    });
  }

  return {
    position,
    get yaw() {
      return yaw;
    },
    get pitch() {
      return pitch;
    },
    get distance() {
      return distance;
    },
    blocked,
    look(horizontal, vertical) {
      yaw = Math.atan2(Math.sin(yaw + horizontal), Math.cos(yaw + horizontal));
      pitch = Math.max(-1.25, Math.min(1.25, pitch + vertical));
    },
    stop() {
      velocity.x = velocity.z = 0;
    },
    /** Stands the visitor at a pose (benchmarks, screenshots and tests). */
    place({ x = position.x, z = position.z, yaw: y = yaw, pitch: p = pitch }) {
      position.x = x;
      position.z = z;
      yaw = y;
      pitch = p;
      this.stop();
    },
    reset() {
      position.x = spawn.x;
      position.z = spawn.z;
      yaw = spawn.yaw;
      pitch = -0.035;
      distance = 0;
      this.stop();
    },
    update(dt, forward, strafe, run = false) {
      const length = Math.max(1, Math.hypot(forward, strafe));
      const speed = run ? 3.7 : 2.5;
      let vx =
        ((-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) / length) * speed;
      let vz =
        ((-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) / length) * speed;
      const line = rail?.(position.x, position.z);
      if (line) {
        const facing = -Math.sin(yaw) * line.x - Math.cos(yaw) * line.z,
          going = (facing < -0.2 ? -forward : forward) * speed * line.pace;
        vx = line.x * going;
        vz = line.z * going;
        const settle = 1 - Math.exp(-dt * 10);
        position.x += line.dx * settle;
        position.z += line.dz * settle;
      }
      const pace = line ? line.pace : 1;
      // A ladder is taken at once at its own pace, so no walking pace carries
      // the eye up it in a lurch.
      const ease = line ? 1 : 1 - Math.exp(-dt * 18);
      velocity.x += (vx - velocity.x) * ease;
      velocity.z += (vz - velocity.z) * ease;
      if (!forward && !strafe && Math.hypot(velocity.x, velocity.z) < 0.025)
        this.stop();
      const steps = Math.max(
        1,
        Math.ceil((Math.hypot(velocity.x, velocity.z) * dt) / 0.06),
      );
      const startX = position.x,
        startZ = position.z;
      for (let i = 0; i < steps; i++) {
        const sx = (velocity.x * dt) / steps,
          sz = (velocity.z * dt) / steps,
          freeX = !blocked(position.x + sx, position.z),
          freeZ = !blocked(position.x + (freeX ? sx : 0), position.z + sz);
        if (freeX) position.x += sx;
        if (freeZ) position.z += sz;
        // Against a curved wall or a turned box neither axis may be free when
        // the way along the surface is. Turn from the push by as little as
        // frees it, keeping only the part of the push that way: walking straight
        // at a surface stays stopped, and walking at a slant slides along it.
        if (!freeX && !freeZ && (sx || sz)) {
          let slid = false;
          for (const turn of SLIDE_TURNS) {
            const c = Math.cos(turn),
              s = Math.sin(turn),
              ax = (sx * c - sz * s) * c,
              az = (sx * s + sz * c) * c;
            if (!blocked(position.x + ax, position.z + az)) {
              position.x += ax;
              position.z += az;
              slid = true;
              break;
            }
          }
          if (slid) continue;
        }
        if (!freeX) velocity.x = 0;
        if (!freeZ) velocity.z = 0;
      }
      const moved = Math.hypot(position.x - startX, position.z - startZ);
      distance += moved / pace;
      return moved;
    },
  };
}
