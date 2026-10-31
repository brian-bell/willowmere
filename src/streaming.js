// Builds the world beyond the village after the game starts, a slice of each
// animation frame at a time, nearest the player first. Each finished piece
// joins the scene only once its shaders have compiled, so streaming never
// stalls a frame on a first draw. See docs/performance.md.
//
// Shaders compile for `target`, the render target the scene is drawn into
// (the composer's), since the program for the screen differs in colour space
// and tone mapping and would go unused.
//
// A job is { x, z, step(deadline) }. `step` works until performance.now()
// passes `deadline`, then returns nothing to be called again next slice, or
// the finished objects (an object, an array, or an empty array) when done.
export function createStreamer(renderer, scene, { budget = 2.5, target = null } = {}) {
  const queue = [],
    // Compiled pieces join the scene one per frame, so their first draws and
    // buffer uploads spread out even when their shaders finish together.
    ready = [],
    parallel = renderer.extensions.has("KHR_parallel_shader_compile");
  let compiling = 0,
    finished = 0;
  function nearest(x, z) {
    let best = 0,
      bestDistance = Infinity;
    for (let i = 0; i < queue.length; i++) {
      const distance = (queue[i].x - x) ** 2 + (queue[i].z - z) ** 2;
      if (distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    }
    return best;
  }
  function place(job, objects, camera) {
    if (!objects.length) {
      finished++;
      job.added?.(objects);
      return;
    }
    compiling++;
    const join = () => {
      compiling--;
      ready.push(() => {
        finished++;
        for (const object of objects) scene.add(object);
        job.added?.(objects);
      });
    };
    // Shared materials are usually compiled already, and resolve at once.
    // Without parallel compiling, compileAsync would block anyway (and warn),
    // so compile directly. compileAsync starts each compile before it
    // returns, so the target only needs setting around the calls.
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    if (!parallel) {
      for (const object of objects) renderer.compile(object, camera, scene);
      renderer.setRenderTarget(previous);
      Promise.resolve().then(join);
      return;
    }
    const compiled = objects.map((object) =>
      renderer.compileAsync(object, camera, scene),
    );
    renderer.setRenderTarget(previous);
    Promise.all(compiled).then(join, join);
  }
  return {
    add(...jobs) {
      queue.push(...jobs);
    },
    /** Jobs still building or compiling. */
    get pending() {
      return queue.length + compiling + ready.length;
    },
    get finished() {
      return finished;
    },
    /**
     * Adds one compiled piece to the scene, then runs jobs for up to `budget`
     * milliseconds, nearest (x, z) first.
     */
    update(x, z, camera) {
      ready.shift()?.();
      if (!queue.length) return;
      const deadline = performance.now() + budget;
      let index = nearest(x, z);
      while (queue.length && performance.now() < deadline) {
        const job = queue[index],
          result = job.step(deadline);
        if (result == null) continue;
        queue.splice(index, 1);
        place(job, [].concat(result), camera);
        index = nearest(x, z);
      }
    },
  };
}
