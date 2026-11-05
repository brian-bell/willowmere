// @ts-check
// Which shadow casters can darken anything in view. The sun's map covers a box of
// ground, and in first person that box is village-sized whichever way the eye
// looks, so most of what it draws falls behind the viewer. A caster matters only
// if its sphere, swept away from the sun down to the lowest receiver, enters the
// view. A plane here is [nx, ny, nz, d], with the normal pointing into the view.

/**
 * @param {{ x: number, y: number, z: number }} center the caster's bounding sphere
 * @param {number} radius
 * @param {{ x: number, y: number, z: number }} toSun unit vector, y above zero
 * @param {number} floor the height of the lowest receiver
 * @param {number[][]} planes
 */
export function casterReachesView(center, radius, toSun, floor, planes) {
  const reach = Math.max(0, (center.y + radius - floor) / toSun.y);
  for (const [nx, ny, nz, d] of planes) {
    const here = nx * center.x + ny * center.y + nz * center.z + d;
    // The shadow moves away from the sun, so along -toSun.
    const along = -(nx * toSun.x + ny * toSun.y + nz * toSun.z) * reach;
    if (Math.max(here, here + along) + radius < 0) return false;
  }
  return true;
}

/**
 * Two vertical planes through the eye that hold every ray of a view, seen from
 * above. A water reflection mirrors the view in a horizontal plane, so it sees
 * the same wedge of ground, which a plane that tilted with the eye would not
 * promise. No planes where the view spans a half turn or more, as when it looks
 * almost straight down.
 *
 * @param {{ x: number, z: number }} eye
 * @param {{ x: number, z: number }} forward unit vector
 * @param {{ x: number, z: number }[]} rays the view's corner rays
 * @param {number} margin radians to spare on each side
 * @param {number} back metres to stand the wedge's point behind the eye
 * @returns {number[][]}
 */
export function viewWedge(eye, forward, rays, margin, back) {
  let left = -Infinity,
    right = Infinity;
  for (const ray of rays) {
    const angle = Math.atan2(
      forward.x * ray.z - forward.z * ray.x,
      forward.x * ray.x + forward.z * ray.z,
    );
    left = Math.max(left, angle);
    right = Math.min(right, angle);
  }
  left += margin;
  right -= margin;
  if (left - right >= Math.PI) return [];
  const x = eye.x - forward.x * back,
    z = eye.z - forward.z * back,
    plane = (/** @type {number} */ angle, /** @type {number} */ side) => {
      const c = Math.cos(angle),
        s = Math.sin(angle),
        dx = forward.x * c - forward.z * s,
        dz = forward.x * s + forward.z * c,
        nx = side * -dz,
        nz = side * dx;
      return [nx, 0, nz, -(nx * x + nz * z)];
    };
  return [plane(left, -1), plane(right, 1)];
}
