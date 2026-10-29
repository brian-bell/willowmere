// Grounded, camera-relative movement. Small swept steps keep the visitor out of
// furniture even during a slow frame; independent axes let them slide along it.
export function createInteriorWalker({ bounds, colliders, spawn }) {
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
      const vx =
        ((-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) / length) * speed;
      const vz =
        ((-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) / length) * speed;
      const ease = 1 - Math.exp(-dt * 18);
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
        const nx = position.x + (velocity.x * dt) / steps;
        const nz = position.z + (velocity.z * dt) / steps;
        if (!blocked(nx, position.z)) position.x = nx;
        else velocity.x = 0;
        if (!blocked(position.x, nz)) position.z = nz;
        else velocity.z = 0;
      }
      const moved = Math.hypot(position.x - startX, position.z - startZ);
      distance += moved;
      return moved;
    },
  };
}
