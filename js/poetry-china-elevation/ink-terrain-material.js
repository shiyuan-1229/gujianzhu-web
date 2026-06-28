/**
 * 青绿山水水墨地形材质 · 源自 splendid-china-3d / main.js
 * https://github.com/leeshinyu2023/splendid-china-3d
 */
import * as THREE from "three";

var inkWashVert =
  "varying vec3 vWorldPosition;\n" +
  "varying vec3 vNormal;\n" +
  "varying float vElevation;\n" +
  "varying vec2 vUv;\n" +
  "varying float vSlope;\n" +
  "void main() {\n" +
  "  vUv = uv;\n" +
  "  vec4 worldPos = modelMatrix * vec4(position, 1.0);\n" +
  "  vWorldPosition = worldPos.xyz;\n" +
  "  vElevation = position.y;\n" +
  "  vec3 worldNormal = normalize(mat3(modelMatrix) * normal);\n" +
  "  vNormal = worldNormal;\n" +
  "  vSlope = 1.0 - abs(dot(worldNormal, vec3(0.0, 1.0, 0.0)));\n" +
  "  gl_Position = projectionMatrix * viewMatrix * worldPos;\n" +
  "}\n";

var inkWashFrag =
  "precision highp float;\n" +
  "varying vec3 vWorldPosition;\n" +
  "varying vec3 vNormal;\n" +
  "varying float vElevation;\n" +
  "varying vec2 vUv;\n" +
  "varying float vSlope;\n" +
  "uniform float uTime;\n" +
  "uniform vec3 uLightDir;\n" +
  "uniform float uShowContour;\n" +
  "uniform float uMaxElev;\n" +
  "float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n" +
  "float noise2D(vec2 p) {\n" +
  "  vec2 i = floor(p); vec2 f = fract(p);\n" +
  "  f = f * f * (3.0 - 2.0 * f);\n" +
  "  float a = hash(i), b = hash(i + vec2(1.0, 0.0));\n" +
  "  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));\n" +
  "  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);\n" +
  "}\n" +
  "float fbm(vec2 p) {\n" +
  "  float v = 0.0, a = 0.5;\n" +
  "  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);\n" +
  "  for (int i = 0; i < 4; i++) { v += a * noise2D(p); p = rot * p * 2.0; a *= 0.5; }\n" +
  "  return v;\n" +
  "}\n" +
  "void main() {\n" +
  "  float maxElev = max(uMaxElev, 0.5);\n" +
  "  float ne = clamp(vElevation / maxElev, 0.0, 1.0);\n" +
  "  vec3 paperColor = vec3(0.96, 0.94, 0.89);\n" +
  "  vec3 plainColor = vec3(0.85, 0.90, 0.80);\n" +
  "  vec3 hillColor = vec3(0.55, 0.72, 0.50);\n" +
  "  vec3 midMtnColor = vec3(0.28, 0.52, 0.42);\n" +
  "  vec3 highMtnColor = vec3(0.15, 0.32, 0.30);\n" +
  "  vec3 snowColor = vec3(0.92, 0.94, 0.96);\n" +
  "  vec3 desertColor = vec3(0.90, 0.82, 0.65);\n" +
  "  vec3 inkColor = vec3(0.12, 0.15, 0.14);\n" +
  "  vec3 elevColor;\n" +
  "  if (ne < 0.05) elevColor = mix(paperColor, plainColor, ne / 0.05);\n" +
  "  else if (ne < 0.15) elevColor = mix(plainColor, hillColor, (ne - 0.05) / 0.10);\n" +
  "  else if (ne < 0.35) elevColor = mix(hillColor, midMtnColor, (ne - 0.15) / 0.20);\n" +
  "  else if (ne < 0.65) elevColor = mix(midMtnColor, highMtnColor, (ne - 0.35) / 0.30);\n" +
  "  else if (ne < 0.85) elevColor = mix(highMtnColor, inkColor, (ne - 0.65) / 0.20);\n" +
  "  else {\n" +
  "    float snowMix = smoothstep(0.85, 0.95, ne + fbm(vWorldPosition.xz * 3.0) * 0.08);\n" +
  "    elevColor = mix(inkColor, snowColor, snowMix);\n" +
  "  }\n" +
  "  float desertZone = smoothstep(-25.0, -15.0, vWorldPosition.x)\n" +
  "    * (1.0 - smoothstep(-8.0, 0.0, vWorldPosition.x))\n" +
  "    * (1.0 - smoothstep(0.0, 5.0, vElevation))\n" +
  "    * smoothstep(-10.0, 0.0, vWorldPosition.z);\n" +
  "  elevColor = mix(elevColor, desertColor, desertZone * 0.7);\n" +
  "  float ridgeNoise = fbm(vWorldPosition.xz * 8.0) * 0.3;\n" +
  "  float ridge = smoothstep(0.15 + ridgeNoise, 0.5 + ridgeNoise, vSlope);\n" +
  "  elevColor = mix(elevColor, inkColor, ridge * 0.6);\n" +
  "  if (uShowContour > 0.5) {\n" +
  "    float f = fract(vElevation / 0.8);\n" +
  "    float contourLine = 1.0 - smoothstep(0.0, 0.03, abs(f - 0.5) * 2.0);\n" +
  "    elevColor = mix(elevColor, inkColor, contourLine * 0.25);\n" +
  "  }\n" +
  "  vec2 hatchUV = vWorldPosition.xz * 3.0;\n" +
  "  float hatchPattern = sin(hatchUV.x * 20.0 + hatchUV.y * 20.0) * 0.5 + 0.5;\n" +
  "  float hatchMask = smoothstep(0.15, 0.4, vSlope) * (1.0 - smoothstep(0.5, 0.8, vSlope));\n" +
  "  elevColor = mix(elevColor, elevColor * 0.7, hatchPattern * hatchMask * 0.3);\n" +
  "  float grain = fbm(vWorldPosition.xz * 60.0) * 0.06;\n" +
  "  elevColor += grain;\n" +
  "  float diffuse = max(dot(vNormal, normalize(uLightDir)), 0.0);\n" +
  "  elevColor = mix(elevColor, elevColor * 1.22, diffuse * 0.35);\n" +
  "  elevColor = mix(elevColor, elevColor * 0.82, (1.0 - diffuse) * 0.18);\n" +
  "  float edgeDist = length(vUv - 0.5) * 1.414;\n" +
  "  float vignette = smoothstep(0.8, 0.4, edgeDist);\n" +
  "  elevColor = mix(elevColor * 0.95, elevColor, vignette);\n" +
  "  gl_FragColor = vec4(elevColor, 1.0);\n" +
  "}\n";

export function createInkTerrainMaterial(maxElev) {
  maxElev = maxElev || 10;
  var material = new THREE.ShaderMaterial({
    vertexShader: inkWashVert,
    fragmentShader: inkWashFrag,
    uniforms: {
      uTime: { value: 0 },
      uLightDir: { value: new THREE.Vector3(0.45, 0.85, 0.35) },
      uShowContour: { value: 1.0 },
      uMaxElev: { value: maxElev }
    }
  });
  return {
    material: material,
    tick: function (t) {
      material.uniforms.uTime.value = t * 0.001;
    },
    dispose: function () {
      material.dispose();
    }
  };
}
