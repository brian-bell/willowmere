import { ShaderChunk } from "three";

// Three evaluates every point light's full BRDF in every lit fragment, even
// where the light's window function is exactly zero past its `distance`. The
// village's lanterns reach 4 m, so nearly all of that work adds nothing, and it
// was the frame's largest single saving (see docs/performance.md). Skipping a
// light out of range gives the same pixels. A light with no `distance` reaches
// everywhere and is always evaluated. Import this before anything compiles.
const IN_RANGE = /* glsl */ `bool pointLightReaches( const in PointLight pointLight, const in vec3 geometryPosition ) {

		vec3 lVector = pointLight.position - geometryPosition;

		return pointLight.distance <= 0.0 || dot( lVector, lVector ) < pointLight.distance * pointLight.distance;

	}

	void getPointLightInfo(`;

function patch(chunk, find, replacement) {
  const patched = ShaderChunk[chunk].replace(find, replacement);
  if (patched === ShaderChunk[chunk])
    throw Error(`Three's ${chunk} chunk changed; update src/shader-chunks.js.`);
  ShaderChunk[chunk] = patched;
}

patch("lights_pars_begin", "void getPointLightInfo(", IN_RANGE);
// The whole light, its shadow included, from the first call to its RE_Direct.
patch(
  "lights_fragment_begin",
  /pointLight = pointLights\[ i \];\s*(getPointLightInfo[\s\S]*?RE_Direct\([^;]*;)/,
  `pointLight = pointLights[ i ];

		if ( pointLightReaches( pointLight, geometryPosition ) ) {

		$1

		}`,
);
