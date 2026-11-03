// The village's broad gravel paths and the plaza around the fountain. Their
// meshes join `flat`, the pieces that only receive shadows.

export function buildPaths(kit, { flat }) {
  const { mat, T, mesh, path, cyl } = kit;
  // Broad connected village paths.
  const pathEdge = mat("#b2ac77");
  function road(x, z, w, d) {
    const horizontal = w > d,
      r = Math.min(w, d) * 0.5,
      core = Math.max(w, d) * 0.5 - r,
      outline = [];
    const add = (u, v) => outline.push(horizontal ? [u, v] : [v, u]);
    for (let u = -core; u <= core + 0.01; u += Math.max(0.3, core / 12))
      add(u, r + Math.sin(u * 2.8 + x) * 0.035 + Math.sin(u * 6 + z) * 0.025);
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI / 2 - (i / 16) * Math.PI;
      add(core + Math.cos(a) * r, Math.sin(a) * r);
    }
    for (let u = core; u >= -core - 0.01; u -= Math.max(0.3, core / 12))
      add(u, -r + Math.sin(u * 3.1 + x) * 0.04);
    for (let i = 0; i <= 16; i++) {
      const a = -Math.PI / 2 - (i / 16) * Math.PI;
      add(-core + Math.cos(a) * r, Math.sin(a) * r);
    }
    const shape = new T.Shape();
    outline.forEach(([a, b], i) =>
      i ? shape.lineTo(a, b) : shape.moveTo(a, b),
    );
    shape.closePath();
    const m = mesh(new T.ShapeGeometry(shape), path, x, 0.105, z);
    m.rotation.x = -Math.PI / 2;
    flat.push(m);
  }
  road(-3, 3, 28, 3.2);
  road(-2, -1.8, 3.2, 12.5);
  road(-7, -1.6, 3.1, 7);
  road(2, -4.5, 3, 6);
  road(16, -0.7, 2.7, 9);
  road(-12, 9, 3, 13);
  road(-6, 10.3, 13, 2.8);
  const plaza = cyl(path, -1, 0.08, 2.7, 5.3, 0.08);
  plaza.scale.z = 4.5;
}
