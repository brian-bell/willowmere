import * as T from "three";

// The materials of the solid canopy pieces. Lit as a plain smooth shell, a
// cluster reads as a ball among the leaves, so the shader breaks its surface
// into leaf-sized cells in world space, each with its own tilt and tone of
// green, and toward the silhouette whole cells drop out, so the edge is
// ragged with leaves instead of round. When a cell covers only a few pixels
// the pattern gives way to a plain shell with a soft edge, so it never
// shimmers.
//
// - `shadeMaterial`: the shade shells inside the orchard's and the wood's
//   crowns. Each cell keeps an angular leaf at its middle, like the leaf
//   blades around it, and the gaps between leaves are open.
// - `crownMaterial`: every tree's distant crown in first person, which
//   stands in for all its leaves: larger cells, closed, some in shade.

const VERTEX_PARS = /* glsl */ `
varying vec3 vCrownWorld;
`;
const VERTEX = /* glsl */ `
vCrownWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
`;
const FRAGMENT_PARS = /* glsl */ `
varying vec3 vCrownWorld;
vec3 crownHash( vec3 p ) {
	p = fract( p * vec3( 0.1031, 0.1030, 0.0973 ) );
	p += dot( p, p.yxz + 33.33 );
	return fract( ( p.xxy + p.yxx ) * p.zyx );
}
// The leaf cell nearest p: returns its hash, and sets reach to how far p
// lies from the cell's own point (x) and from the edge it shares with the
// next cell (y). Searches the 2 x 2 x 2 cells around p's nearest
// corner, which is enough for points jittered within their cells.
vec3 crownCell( vec3 p, out vec2 reach ) {
	vec3 base = floor( p - 0.5 ), hash = vec3( 0.0 );
	float f1 = 8.0, f2 = 8.0;
	for ( int i = 0; i < 8; i ++ ) {
		vec3 cell = base + vec3( float( i & 1 ), float( ( i >> 1 ) & 1 ), float( i >> 2 ) );
		vec3 h = crownHash( cell );
		vec3 r = cell + 0.2 + 0.6 * h - p;
		float d = dot( r, r );
		if ( d < f1 ) {
			f2 = f1;
			f1 = d;
			hash = h;
		} else if ( d < f2 ) f2 = d;
	}
	f1 = sqrt( f1 );
	reach = vec2( f1, sqrt( f2 ) - f1 );
	return hash;
}
`;
const FRAGMENT = /* glsl */ `
{
	vec3 cellP = vCrownWorld * CROWN_CELLS;
	// How much of a cell one pixel spans: past about a third, fade the leaves.
	float blur = smoothstep( 0.18, 0.45, length( fwidth( cellP ) ) );
	vec2 reach;
	vec3 hash = crownCell( cellP, reach );
	float leaf = 1.0 - blur;
	vec3 viewDir = normalize( vViewPosition );
	float rim = 1.0 - abs( dot( normal, viewDir ) );
	if ( leaf > 0.5 ) {
		#ifdef CROWN_OPEN
			// A shell's cells: some empty, the rest a leaf with open gaps.
			if ( rim > 0.45 + 0.5 * hash.y || hash.x < 0.22 ) discard;
			if ( reach.y < 0.16 || reach.x > 0.48 + 0.2 * hash.x ) discard;
		#else
			if ( rim > 0.62 + 0.35 * hash.y ) discard;
		#endif
	} else if ( rim > 0.8 ) discard;
	// Each leaf turns its own way; together they face the sky more than a
	// ball does, so the cluster takes the light evenly.
	vec3 up = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
	vec3 turn = ( viewMatrix * vec4( hash * 2.0 - 1.0, 0.0 ) ).xyz;
	normal = normalize( mix( normal, up, 0.45 ) + turn * 0.6 * leaf );
	// Its own tone of green; on a closed crown, some leaves lie in shade.
	float tone = 0.75 + 0.45 * hash.z;
	#ifndef CROWN_OPEN
		if ( hash.x < 0.3 ) tone *= 0.62;
	#endif
	diffuseColor.rgb *= mix( 0.92, tone, leaf );
}
`;

function leafy(cells, open, key) {
  const material = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
  });
  material.defines = { CROWN_CELLS: cells.toFixed(2) };
  if (open) material.defines.CROWN_OPEN = "";
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERTEX_PARS}`)
      .replace("#include <project_vertex>", `#include <project_vertex>\n${VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAGMENT_PARS}`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${FRAGMENT}`);
  };
  material.customProgramCacheKey = () => key;
  return material;
}

/** Shade shells inside near crowns: about 0.28 m leaves, gaps open. */
export const shadeMaterial = () => leafy(3.6, true, "willowmere-crown-shade-v1");
/** Distant crowns: about 0.42 m leaves, closed. */
export const crownMaterial = () => leafy(2.4, false, "willowmere-crown-far-v1");
