import * as T from "three";
// A warm silhouette keeps the traveler legible behind foreground scenery.
export function createPlayerVisibility(
  scene,
  player,
  colliders,
  treeCanopies = [],
) {
  const material = new T.MeshBasicMaterial({
    color: "#f8dba3",
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.62,
  });
  const ghost = player.clone(true),
    pairs = [];
  function pair(source, copy) {
    pairs.push([source, copy]);
    if (source.isMesh && source.geometry?.type !== "CircleGeometry") {
      source.material = source.material.clone();
      source.material.transparent = true;
      source.renderOrder = 2001;
    }
    if (copy.isMesh) {
      copy.material = material;
      copy.castShadow = false;
      copy.receiveShadow = false;
      copy.renderOrder = 2000;
    }
    if (copy.geometry?.type === "CircleGeometry") copy.visible = false;
    source.children.forEach((child, i) => pair(child, copy.children[i]));
  }
  pair(player, ghost);
  ghost.visible = false;
  scene.add(ghost);
  const volumes = [
    ...treeCanopies,
    ...colliders.flatMap((c) => {
      if (c.w > 3 && c.w < 7 && c.d > 3 && c.d < 6)
        return [
          new T.Box3(
            new T.Vector3(c.x - c.w / 2, 0, c.z - c.d / 2),
            new T.Vector3(c.x + c.w / 2, 5.5, c.z + c.d / 2),
          ),
        ];
      return [];
    }),
  ];
  const ray = new T.Ray(),
    target = new T.Vector3(),
    intersection = new T.Vector3();
  return {
    update(camera, enabled = true) {
      target.copy(player.position).y += 0.15;
      ray.origin.copy(camera.position);
      ray.direction.copy(target).sub(camera.position).normalize();
      const distance = camera.position.distanceTo(target);
      const hidden =
        enabled &&
        volumes.some((v) => {
          const hit = v.isBox3
            ? ray.intersectBox(v, intersection)
            : ray.intersectSphere(v, intersection);
          return hit && ray.origin.distanceTo(hit) < distance - 0.3;
        });
      ghost.visible = hidden;
      if (hidden)
        for (const [source, copy] of pairs) {
          copy.position.copy(source.position);
          copy.quaternion.copy(source.quaternion);
          copy.scale.copy(source.scale);
        }
    },
  };
}
