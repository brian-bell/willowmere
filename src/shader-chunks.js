import { ShaderChunk, ShaderLib } from "three";

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

// PCFSoftShadowMap's sixteen fetches on a 4 × 4 grid weigh each row and column
// by [1 - f, 1, 1, f], where f is the fragment's place between texels. Each outer
// pair of that is one bilinear fetch placed to give the pair's two weights, so
// four fetches of a comparison sampler filter exactly the same sixteen texels
// (src/shadow-maps.js supplies the depth texture). No mips, so no derivatives.
const GET_SHADOW = /* glsl */ `float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {

		float shadow = 1.0;

		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;

		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;

		if ( inFrustum && shadowCoord.z <= 1.0 ) {

			vec2 texel = shadowCoord.xy * shadowMapSize - 0.5;
			vec2 base = floor( texel );
			vec2 f = texel - base;
			vec2 w0 = 2.0 - f;
			vec2 w1 = 1.0 + f;
			vec2 p0 = ( base - 0.5 + 1.0 / w0 ) / shadowMapSize;
			vec2 p1 = ( base + 1.5 + f / w1 ) / shadowMapSize;

			shadow = (
				w0.x * w0.y * textureLod( shadowMap, vec3( p0.x, p0.y, shadowCoord.z ), 0.0 ) +
				w1.x * w0.y * textureLod( shadowMap, vec3( p1.x, p0.y, shadowCoord.z ), 0.0 ) +
				w0.x * w1.y * textureLod( shadowMap, vec3( p0.x, p1.y, shadowCoord.z ), 0.0 ) +
				w1.x * w1.y * textureLod( shadowMap, vec3( p1.x, p1.y, shadowCoord.z ), 0.0 )
			) / 9.0;

		}

		return mix( 1.0, shadow, shadowIntensity );

	}`;

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

patch("shadowmap_pars_fragment", "uniform sampler2D directionalShadowMap", "uniform sampler2DShadow directionalShadowMap");
patch("shadowmap_pars_fragment", "uniform sampler2D spotShadowMap", "uniform sampler2DShadow spotShadowMap");
patch(
  "shadowmap_pars_fragment",
  /float getShadow\( sampler2D shadowMap[\s\S]*?return mix\( 1\.0, shadow, shadowIntensity \);\s*\}/,
  GET_SHADOW,
);

// With no colour attachment, a shadow map's depth program has nothing to pack,
// and a fragment shader with no work lets the GPU skip running it at all.
{
  const unused = /float fragCoordZ = 0\.5[\s\S]*gl_FragColor = packDepthToRGBA\( fragCoordZ \);/;
  const { fragmentShader } = ShaderLib.depth;
  if (!unused.test(fragmentShader) || !/#ifdef USE_REVERSED_DEPTH_BUFFER\s*float fragCoordZ/.test(fragmentShader))
    throw Error("Three's depth program changed; update src/shader-chunks.js.");
  ShaderLib.depth.fragmentShader = fragmentShader
    .replace(/#ifdef USE_REVERSED_DEPTH_BUFFER\s*float fragCoordZ[\s\S]*?#endif/, "")
    .replace(/#if DEPTH_PACKING == 3200\s*gl_FragColor[\s\S]*?#endif/, "");
}
