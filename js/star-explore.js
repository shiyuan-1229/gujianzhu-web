/**
 * 古建星云 · 星际探索
 * Three.js 旋臂星系 + 高密度知识关联 + 可选 MediaPipe 手势
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const TYPE_META = {
  scientist:   { color: 0xfff4c8, label: "建筑科学家", en: "Architect", scale: 1.0 },
  book:        { color: 0xd4f5e0, label: "建筑著作",   en: "Treatise", scale: 0.95 },
  achievement: { color: 0xa8d8cc, label: "建筑成就",   en: "Achievement", scale: 0.62 },
  building:    { color: 0xffd8e4, label: "建筑实例",   en: "Building", scale: 1.0 },
};

const UI = {
  zh: {
    all: "全部", detail: "查看详情", relate: "关联", empty: "未找到匹配的星辰",
    grpScientist: "匠师", grpBook: "著作", grpAchievement: "形制技艺", grpBuilding: "建筑实例",
  },
  en: {
    all: "All", detail: "Open page", relate: "Linked", empty: "No matching star",
    grpScientist: "Architects", grpBook: "Treatises", grpAchievement: "Craft & form", grpBuilding: "Buildings",
  },
};
const lang = (typeof window.resolveSiteLang === "function" ? window.resolveSiteLang() : "zh") === "en" ? "en" : "zh";
const tt = UI[lang];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

function planetTargetAt(i) {
  const h = hash("pt" + i);
  const h2 = hash("pr" + i);
  if (i % 10 < 7) {
    const idx = i % 2000;
    const y = 1 - (idx + 0.5) / 2000 * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * 2.399963229728653;
    const rad = 82 + h * 18;
    return { x: Math.cos(phi) * r * rad, y: y * rad, z: Math.sin(phi) * r * rad, ring: 0 };
  }
  const a = h * Math.PI * 2;
  const rr = 112 + h2 * 136;
  const lx = Math.cos(a) * rr;
  const lz = Math.sin(a) * rr;
  const ly = (h2 - 0.5) * 4;
  return { x: lx, y: ly, z: lz, ring: 1 };
}

function fillPlanetTargets(count) {
  const targets = new Float32Array(count * 3);
  const rings = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const t = planetTargetAt(i);
    targets[i * 3] = t.x;
    targets[i * 3 + 1] = t.y;
    targets[i * 3 + 2] = t.z;
    rings[i] = t.ring;
  }
  return { targets, rings };
}

function setConvergeUniforms() {
  const cv = gestureFX.converge;
  const rf = gestureFX.ringFlare;
  if (dustMat?.uniforms) {
    dustMat.uniforms.convergeFactor.value = cv;
    dustMat.uniforms.ringFlare.value = rf;
  }
  if (starMat?.uniforms) {
    starMat.uniforms.convergeFactor.value = cv;
    starMat.uniforms.ringFlare.value = rf;
  }
}
function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }

const YEAR_MIN = -600, YEAR_MAX = 1911;
const ARMS = 4, TWIST = 0.0092;
const R_GALAXY = 560, R_IN = 70, R_OUT = 380;

const RAMP = [
  { t: 0.00, c: [1.00, 0.97, 0.88] },
  { t: 0.18, c: [0.85, 1.00, 0.80] },
  { t: 0.42, c: [0.36, 0.96, 0.66] },
  { t: 0.66, c: [1.00, 0.62, 0.34] },
  { t: 0.85, c: [1.00, 0.36, 0.42] },
  { t: 1.00, c: [0.95, 0.34, 0.74] },
];
function rampColor(t, out) {
  t = Math.min(1, Math.max(0, t));
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= RAMP[i].t) {
      const a = RAMP[i - 1], b = RAMP[i], k = (t - a.t) / (b.t - a.t);
      out[0] = a.c[0] + (b.c[0] - a.c[0]) * k;
      out[1] = a.c[1] + (b.c[1] - a.c[1]) * k;
      out[2] = a.c[2] + (b.c[2] - a.c[2]) * k;
      return out;
    }
  }
  out[0] = 0.95; out[1] = 0.34; out[2] = 0.74; return out;
}

function spiralPos(r, seedA, seedS, thick) {
  const base = (Math.floor(seedA * ARMS) / ARMS) * Math.PI * 2;
  const theta = base + r * TWIST + (seedS - 0.5) * 0.55;
  return new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), (Math.random() - 0.5) * thick);
}
function positionFor(star) {
  const t = Math.min(1, Math.max(0, (star.year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)));
  const r = R_IN + (R_OUT - R_IN) * Math.pow(t, 0.92) + (hash(star.id + "r") - 0.5) * 30;
  const base = (Math.floor(hash(star.id + "a") * ARMS) / ARMS) * Math.PI * 2;
  const theta = base + r * TWIST + (hash(star.id + "s") - 0.5) * 0.5;
  return new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), (hash(star.id + "z") - 0.5) * 16);
}

function makeDustTexture() {
  const s = 64, c = document.createElement("canvas"); c.width = c.height = s;
  const g = c.getContext("2d");
  const cx = s / 2;
  const grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grd.addColorStop(0, "rgba(255,255,255,0.95)");
  grd.addColorStop(0.2, "rgba(255,255,255,0.35)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 知识节点 · 精致小光点（比星尘略亮，但不臃肿） */
function makeNodeTexture() {
  const s = 64, c = document.createElement("canvas"); c.width = c.height = s;
  const g = c.getContext("2d");
  const cx = s / 2;
  const grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx * 0.55);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.1, "rgba(255,252,225,1)");
  grd.addColorStop(0.28, "rgba(255,238,185,0.7)");
  grd.addColorStop(0.55, "rgba(255,255,255,0.2)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const DUST_VERT = `
  attribute vec3 color;
  attribute vec3 aTarget;
  attribute float aRing;
  uniform float scatterFactor;
  uniform float convergeFactor;
  uniform float ringFlare;
  varying vec3 vColor;
  varying float vConv;
  void main() {
    vColor = color;
    vec3 tgt = aTarget;
    tgt.xz *= mix(1.0, ringFlare, aRing);
    vec3 scattered = position * scatterFactor;
    vec3 p = mix(scattered, tgt, convergeFactor);
    vConv = convergeFactor;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = min(mix(1.15, 2.4, convergeFactor) * (300.0 / -mv.z), mix(4.2, 14.0, convergeFactor));
    gl_Position = projectionMatrix * mv;
  }
`;
const DUST_FRAG = `
  uniform sampler2D uTex;
  varying vec3 vColor;
  varying float vConv;
  void main() {
    vec4 t = texture2D(uTex, gl_PointCoord);
    if (t.a < 0.02) discard;
    vec3 col = vColor * (1.0 + vConv * 0.85);
    gl_FragColor = vec4(col, mix(1.0, 0.92, vConv * 0.3)) * t;
  }
`;

const STAR_VERT = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aTarget;
  attribute float aRing;
  uniform float scatterFactor;
  uniform float convergeFactor;
  uniform float ringFlare;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vConv;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec3 tgt = aTarget;
    tgt.xz *= mix(1.0, ringFlare, aRing);
    vec3 scattered = position * scatterFactor;
    vec3 p = mix(scattered, tgt, convergeFactor);
    vConv = convergeFactor;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = min(aSize * mix(1.0, 1.8, convergeFactor) * (330.0 / -mv.z), mix(22.0, 30.0, convergeFactor));
    gl_Position = projectionMatrix * mv;
  }
`;
const STAR_FRAG = `
  uniform sampler2D uTex;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vConv;
  void main() {
    vec4 t = texture2D(uTex, gl_PointCoord);
    if (t.a < 0.02) discard;
    vec3 col = vColor * (1.0 + t.r * 0.65 + vConv * 0.75);
    gl_FragColor = vec4(col, vAlpha) * t;
  }
`;

let scene, camera, renderer, composer, controls, raycaster, galaxy;
let starGeo, starPoints, starMat, dustTex, nodeTex, dustMat, dustPoints;
let cruiseActive = false, cruiseAngle = 0, cruiseRadius = 0, cruiseY = 0;
const keyMove = { w: false, a: false, s: false, d: false };
let stars = [], idIndex = {}, adjacency = {}, lore = [], voidTimer = null;
let baseSizes = null, starDegrees = null, basePositions = null;
let activeFilter = "all", hovered = -1, selected = -1;
let selRelated = [], focusSet = null;
let linkLine = null, linkAnim = null, labelLayer, rotating = true;
let bounceAnim = null;
const pointer = new THREE.Vector2(-2, -2);
const tmpV = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
let panelCollapsed = false;
let panelTabName = "";
let camTween = null;
let handApi = null;
let bloomPass = null;
let frameN = 0;
let galaxyRevKey = "";
const BASE_BLOOM = 0.82;
const gestureFX = { bloom: 0, spin: 0, mode: null, converge: 0, ringFlare: 1 };

/* 默认视角 · 俯看旋臂银河（手势操控起始视角） */
const HOME_CAM = new THREE.Vector3(0, 44, 618);
const HOME_TGT = new THREE.Vector3(0, 0, 0);
const HOME_GAL_ROT = { x: 0.1, y: 0.16, z: 0 };

/* 漫游视角 · 正面机位（同主视角朝向，离银河近一点，缓慢水平平移） */
const CRUISE_CAM = new THREE.Vector3(0, -420, 240);
const CRUISE_TGT = new THREE.Vector3(0, 60, 0);

/* 主视野标签锥：只有看向银河带中央时，名字才在视野内渐显 */
const LABEL_VIEW = {
  rx: 0.4, ry: 0.3, soft: 0.22,
  axisDot: 0.68,
  distMin: 85, distMax: 740,
  max: 14, gap: 54,
};
const canvasHost = document.getElementById("galaxy");
const isMobile = window.matchMedia("(max-width: 768px)").matches;

function hideLoading() {
  document.getElementById("loading")?.classList.add("hidden");
}

function showLoadError(msg) {
  if (typeof window.__starBootErr === "function") window.__starBootErr(msg);
  else console.error(msg);
}

function setLoadStatus(text) {
  const t = document.querySelector("#loading div:last-child");
  if (t) t.textContent = text;
}

init().catch((e) => showLoadError("加载失败：" + (e?.message || e)));

async function init() {
  if (!canvasHost) throw new Error("页面容器未就绪");
  if (location.protocol === "file:") {
    throw new Error("不能直接打开本地文件，请运行：python3 -m http.server 8778");
  }

  setLoadStatus("加载星辰数据…");
  const res = await fetch("./data/star-cloud.json");
  if (!res.ok) throw new Error("星辰数据加载失败 (" + res.status + ")");
  const data = await res.json();
  stars = data.stars;
  lore = data.lore || [];
  stars.forEach((s, i) => { idIndex[s.id] = i; });
  buildAdjacency();

  setLoadStatus("构建星云…");
  setupScene();
  buildGalaxyDust();
  buildStars();
  buildLabels();
  bindUI();
  document.getElementById("starCount").textContent = String(stars.length);
  controls.update();
  camera.updateProjectionMatrix();
  hideLoading();
  animate();
}

function linkIds(a, b) {
  if (adjacency[a] && adjacency[b]) { adjacency[a].add(b); adjacency[b].add(a); }
}

function buildAdjacency() {
  stars.forEach((s) => { adjacency[s.id] = new Set(); });
  stars.forEach((s) => (s.related || []).forEach((r) => linkIds(s.id, r)));
  stars.forEach((s) => {
    if (s.parent) linkIds(s.id, s.parent);
    (s.works || []).forEach((w) => linkIds(s.id, w));
    (s.architects || []).forEach((a) => linkIds(s.id, a));
  });
  starDegrees = stars.map((s) => adjacency[s.id].size);
}

function computeEgoIndices(centerIdx) {
  const center = stars[centerIdx];
  const ego = new Set([centerIdx]);
  for (const rid of adjacency[center.id] || []) {
    const k = idIndex[rid];
    if (k != null) ego.add(k);
  }
  (center.works || []).forEach((w) => { if (idIndex[w] != null) ego.add(idIndex[w]); });
  if (center.parent && idIndex[center.parent] != null) ego.add(idIndex[center.parent]);
  return ego;
}

function setupScene() {
  if (!canvasHost) throw new Error("找不到 #galaxy 容器");
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  galaxy = new THREE.Group();
  scene.add(galaxy);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 6000);
  camera.position.copy(HOME_CAM);

  renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: "high-performance" });
  if (!renderer.getContext()) throw new Error("WebGL 不可用，请换用 Chrome / Safari 并重试");
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.35 : 1.75));
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvasHost.appendChild(renderer.domElement);

  composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    isMobile ? 0.58 : BASE_BLOOM, 0.5, 0.07);
  composer.addPass(bloomPass);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME_TGT);
  controls.enableDamping = true; controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.5; controls.minDistance = 30; controls.maxDistance = 1600;

  galaxy.rotation.set(HOME_GAL_ROT.x, HOME_GAL_ROT.y, HOME_GAL_ROT.z);

  raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 4.5;
  dustTex = makeDustTexture();
  nodeTex = makeNodeTexture();
  window.addEventListener("resize", onResize);
}

function buildGalaxyDust() {
  const N = isMobile ? 8000 : 20000;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const rc = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const onArm = Math.random() < 0.82;
    const rr = Math.pow(Math.random(), 2.4);
    const r = rr * R_GALAXY;
    let p;
    if (onArm) p = spiralPos(r, Math.random(), 0.5 + gauss() * 0.5, 26 * (1 - rr * 0.6) + 4);
    else {
      const th = Math.random() * Math.PI * 2;
      p = new THREE.Vector3(r * Math.cos(th), r * Math.sin(th), (Math.random() - 0.5) * 60 * (1 - rr * 0.5));
    }
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    rampColor(rr + (Math.random() - 0.5) * 0.08, rc);
    const bri = (rr < 0.12 ? 1.28 : 0.62 + (1 - rr) * 0.48) * (0.78 + Math.random() * 0.42);
    col[i * 3] = rc[0] * bri; col[i * 3 + 1] = rc[1] * bri; col[i * 3 + 2] = rc[2] * bri;
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const pt = fillPlanetTargets(N);
  g.setAttribute("aTarget", new THREE.BufferAttribute(pt.targets, 3));
  g.setAttribute("aRing", new THREE.BufferAttribute(pt.rings, 1));
  dustMat = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: dustTex },
      scatterFactor: { value: 1.0 },
      convergeFactor: { value: 0.0 },
      ringFlare: { value: 1.0 },
    },
    vertexShader: DUST_VERT,
    fragmentShader: DUST_FRAG,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  dustPoints = new THREE.Points(g, dustMat);
  galaxy.add(dustPoints);
}

function buildStars() {
  const n = stars.length;
  const positions = new Float32Array(n * 3);
  basePositions = new Float32Array(n * 3);
  const aColor = new Float32Array(n * 3), aSize = new Float32Array(n), aAlpha = new Float32Array(n);
  baseSizes = new Float32Array(n);
  const c = new THREE.Color();
  const white = new THREE.Color(0xffffff);
  const gold = new THREE.Color(0xfff4c8);
  stars.forEach((s, i) => {
    const p = positionFor(s); s._pos = p; s._world = p.clone();
    positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
    basePositions[i * 3] = p.x; basePositions[i * 3 + 1] = p.y; basePositions[i * 3 + 2] = p.z;
    const meta = TYPE_META[s.type] || TYPE_META.achievement;
    if (s.type === "scientist") {
      c.copy(gold);
      c.lerp(white, 0.22);
      aAlpha[i] = 1.0;
    } else if (s.type === "book") {
      c.setHex(meta.color);
      c.lerp(white, 0.16);
      aAlpha[i] = 0.96;
    } else if (s.type === "building") {
      c.setHex(meta.color);
      c.lerp(gold, 0.22);
      aAlpha[i] = 0.95;
    } else {
      c.setHex(meta.color);
      c.lerp(white, 0.35);
      aAlpha[i] = 0.48;
    }
    aColor[i * 3] = c.r; aColor[i * 3 + 1] = c.g; aColor[i * 3 + 2] = c.b;
    const deg = Math.min(starDegrees[i] || 0, 14);
    const sz = (3.0 + (s.weight || 0.5) * 4.8 + deg * 0.18) * (meta.scale || 1);
    baseSizes[i] = sz; aSize[i] = sz;
  });
  starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute("aColor", new THREE.BufferAttribute(aColor, 3));
  starGeo.setAttribute("aSize", new THREE.BufferAttribute(aSize, 1));
  starGeo.setAttribute("aAlpha", new THREE.BufferAttribute(aAlpha, 1));
  const pt = fillPlanetTargets(n);
  starGeo.setAttribute("aTarget", new THREE.BufferAttribute(pt.targets, 3));
  starGeo.setAttribute("aRing", new THREE.BufferAttribute(pt.rings, 1));
  starMat = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: nodeTex },
      scatterFactor: { value: 1.0 },
      convergeFactor: { value: 0.0 },
      ringFlare: { value: 1.0 },
    },
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  starPoints = new THREE.Points(starGeo, starMat);
  galaxy.add(starPoints);
}

function buildLabels() {
  labelLayer = document.getElementById("labels");
  if (!labelLayer) return;
  const frag = document.createDocumentFragment();
  stars.forEach((s) => {
    const el = document.createElement("div");
    el.className = "star-label"; el.textContent = s.name;
    frag.appendChild(el); s._label = el;
  });
  labelLayer.appendChild(frag);
}

function setFilter(type) {
  activeFilter = type;
  stars.forEach((s) => { s._dim = !(type === "all" || s.type === type); });
  applyAlpha();
  document.querySelectorAll(".filter-chip").forEach((el) => el.classList.toggle("active", el.dataset.type === type));
}

function highlight() {
  const aSize = starGeo.getAttribute("aSize");
  for (let k = 0; k < stars.length; k++) aSize.setX(k, baseSizes[k]);
  selRelated.forEach((k) => aSize.setX(k, baseSizes[k] * 1.3));
  if (hovered >= 0) aSize.setX(hovered, baseSizes[hovered] * 1.45);
  if (selected >= 0) aSize.setX(selected, baseSizes[selected] * 1.6);
  aSize.needsUpdate = true;
}

function applyAlpha() {
  const aAlpha = starGeo.getAttribute("aAlpha");
  for (let k = 0; k < stars.length; k++) {
    let a;
    if (focusSet) a = focusSet.has(k) ? (stars[k].type === "achievement" ? 0.92 : 1.0) : 0.04;
    else if (activeFilter === "all" || stars[k].type === activeFilter) {
      a = stars[k].type === "achievement" ? 0.52 : 0.96;
    } else a = 0.05;
    aAlpha.setX(k, a);
  }
  aAlpha.needsUpdate = true;
}

function startBounce(centerIdx) {
  const pos = starGeo.getAttribute("position");
  const rel = selRelated.filter((k) => k !== centerIdx);
  bounceAnim = { t: 0, center: centerIdx, rel, from: new Float32Array(pos.array) };
}

function updateBounce() {
  if (!bounceAnim) return;
  bounceAnim.t = Math.min(1, bounceAnim.t + 0.04);
  const e = Math.sin(bounceAnim.t * Math.PI);
  const pos = starGeo.getAttribute("position");
  const c = stars[bounceAnim.center]._pos;
  for (const k of bounceAnim.rel) {
    const s = stars[k]._pos;
    const dx = s.x - c.x, dy = s.y - c.y, dz = s.z - c.z;
    const i3 = k * 3;
    pos.array[i3] = s.x + dx * e * 0.22;
    pos.array[i3 + 1] = s.y + dy * e * 0.22;
    pos.array[i3 + 2] = s.z + dz * e * 0.22;
  }
  pos.needsUpdate = true;
  if (bounceAnim.t >= 1) {
    for (let k = 0; k < stars.length; k++) {
      const i3 = k * 3;
      pos.array[i3] = basePositions[i3];
      pos.array[i3 + 1] = basePositions[i3 + 1];
      pos.array[i3 + 2] = basePositions[i3 + 2];
    }
    pos.needsUpdate = true;
    bounceAnim = null;
  }
}

function selectStar(i, ego = true) {
  exitCruise();
  selected = i; rotating = false;
  focusSet = ego ? computeEgoIndices(i) : new Set([i]);
  selRelated = [...focusSet].filter((k) => k !== i);
  applyAlpha(); highlight();
  linkAnim = { from: 0, to: selRelated.length, cur: 0, center: i };
  drawLinks(i, 0);
  showPanel(i);
  galaxy.updateMatrixWorld(true);
  flyToEgo(i);
  startBounce(i);
}

function clearSelection() {
  selected = -1; rotating = true; selRelated = []; focusSet = null; linkAnim = null; bounceAnim = null;
  setPanelCollapsed(false);
  applyAlpha(); highlight(); drawLinks(-1);
  document.getElementById("panel").classList.remove("open");
  const tabNm = document.getElementById("panelTabName");
  if (tabNm) tabNm.textContent = "详情";
}

function drawLinks(i, segCount) {
  if (linkLine) { galaxy.remove(linkLine); linkLine.geometry.dispose(); linkLine = null; }
  if (i < 0 || !selRelated.length) return;
  const s = stars[i];
  const count = segCount == null ? selRelated.length : Math.min(segCount, selRelated.length);
  const segs = [];
  for (let j = 0; j < count; j++) {
    const r = stars[selRelated[j]];
    segs.push(s._pos.x, s._pos.y, s._pos.z, r._pos.x, r._pos.y, r._pos.z);
  }
  if (!segs.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(segs, 3));
  const m = new THREE.LineBasicMaterial({ color: 0xe8b84b, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending });
  linkLine = new THREE.LineSegments(g, m);
  galaxy.add(linkLine);
}

function setPanelCollapsed(collapsed) {
  panelCollapsed = collapsed;
  document.body.classList.toggle("panel-collapsed", collapsed);
  const panel = document.getElementById("panel");
  const tab = document.getElementById("panelTab");
  const btn = document.getElementById("panelMinimize");
  if (tab) tab.style.display = collapsed && panel?.classList.contains("open") ? "block" : "none";
  if (btn) btn.textContent = collapsed ? "展开" : "收起";
}

function showPanel(i) {
  const s = stars[i], meta = TYPE_META[s.type] || TYPE_META.achievement;
  const panel = document.getElementById("panel");
  const yr = s.year < 0 ? `公元前${-s.year}` : `${s.year}年`;
  const hex = "#" + meta.color.toString(16).padStart(6, "0");
  panel.querySelector(".panel-type").textContent = lang === "en" ? meta.en : meta.label;
  panel.querySelector(".panel-type").style.color = hex;
  const nm = panel.querySelector(".panel-name"); nm.textContent = s.name; nm.style.color = hex;
  panel.querySelector(".panel-meta").textContent = `${s.dynasty || ""} · ${yr}${s.category ? " · " + s.category : ""}`;
  panel.querySelector(".panel-summary").textContent = s.summary || "";
  panel.querySelector(".panel-tags").innerHTML = (s.tags || []).map((t) => `<span>${t}</span>`).join("");

  const groups = { scientist: [], book: [], achievement: [], building: [] };
  for (const rid of adjacency[s.id] || []) {
    const rs = stars[idIndex[rid]];
    if (rs) groups[rs.type]?.push(rs.name);
  }
  const rel = panel.querySelector(".panel-related");
  const parts = [];
  if (groups.scientist.length) parts.push(`<div class="rel-group"><b>${tt.grpScientist}</b>${groups.scientist.map((n) => `<i>${n}</i>`).join("、")}</div>`);
  if (groups.book.length) parts.push(`<div class="rel-group"><b>${tt.grpBook}</b>${groups.book.map((n) => `<i>${n}</i>`).join("、")}</div>`);
  if (groups.achievement.length) parts.push(`<div class="rel-group"><b>${tt.grpAchievement}</b>${groups.achievement.map((n) => `<i>${n}</i>`).join("、")}</div>`);
  if (groups.building.length) parts.push(`<div class="rel-group"><b>${tt.grpBuilding}</b>${groups.building.map((n) => `<i>${n}</i>`).join("、")}</div>`);
  rel.innerHTML = parts.length ? parts.join("") : `<b>${tt.relate}：</b>—`;

  const link = panel.querySelector(".panel-link");
  if (s.type === "building" && s.building) {
    link.style.display = "inline-flex";
    link.href = `./detail.html?building=${encodeURIComponent(s.building)}&lang=${lang}`;
    link.textContent = tt.detail + " →";
  } else link.style.display = "none";

  panelTabName = s.name.length > 5 ? s.name.slice(0, 5) + "…" : s.name;
  const tab = document.getElementById("panelTab");
  const tabNm = document.getElementById("panelTabName");
  if (tabNm) tabNm.textContent = panelTabName;
  if (tab) tab.title = `展开：${s.name}`;

  panel.classList.add("open");
  setPanelCollapsed(true);
}

function flyToEgo(centerIdx) {
  const ego = computeEgoIndices(centerIdx);
  const box = new THREE.Box3();
  for (const k of ego) {
    tmpV.copy(stars[k]._pos);
    box.expandByPoint(tmpV);
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.55, 120);
  const dir = camera.position.clone().sub(controls.target).normalize();
  const dist = Math.max(100, radius * 1.35 + 90);
  camTween = {
    t: 0,
    camFrom: camera.position.clone(),
    camTo: center.clone().add(dir.multiplyScalar(dist)),
    tgtFrom: controls.target.clone(),
    tgtTo: center.clone(),
  };
}

function flyTo(target) {
  const dir = camera.position.clone().sub(controls.target).normalize();
  const dist = Math.max(80, target.length() * 0.4 + 110);
  camTween = { t: 0, camFrom: camera.position.clone(), camTo: target.clone().add(dir.multiplyScalar(dist)),
    tgtFrom: controls.target.clone(), tgtTo: target.clone() };
}

function enterCruise() {
  clearSelection();
  cruiseActive = true;
  rotating = true; // 镜头钉死，但银河继续绕轴自转（星转）
  galaxy.rotation.set(0, 0, 0); // 漫游时银盘摆平，便于「前景在下、远景在上」的斜俯视
  document.getElementById("cruiseView")?.classList.add("active");
  cruiseAngle = 0;
  camTween = {
    t: 0, speed: 0.012,
    camFrom: camera.position.clone(), camTo: CRUISE_CAM.clone(),
    tgtFrom: controls.target.clone(), tgtTo: CRUISE_TGT.clone(),
  };
}

function exitCruise() {
  if (!cruiseActive) return;
  cruiseActive = false;
  rotating = true;
  galaxy.rotation.x = HOME_GAL_ROT.x; galaxy.rotation.y = HOME_GAL_ROT.y; // 恢复倾角，保留已累积的自转 z
  document.getElementById("cruiseView")?.classList.remove("active");
}

function updateTween() {
  if (!camTween) return;
  camTween.t = Math.min(1, camTween.t + 0.03);
  const e = 1 - Math.pow(1 - camTween.t, 3);
  camera.position.lerpVectors(camTween.camFrom, camTween.camTo, e);
  controls.target.lerpVectors(camTween.tgtFrom, camTween.tgtTo, e);
  if (camTween.t >= 1) camTween = null;
}

/** WASD 控制视角：W 拉近 / S 拉远 / A·D 左右平移 */
function updateKeyMove() {
  if (camTween) return; // 飞行动画中不接管
  if (!keyMove.w && !keyMove.a && !keyMove.s && !keyMove.d) return;
  tmpDir.copy(controls.target).sub(camera.position);
  const dist = tmpDir.length() || 1;
  tmpDir.divideScalar(dist); // 视线单位向量
  const speed = Math.max(6, dist * 0.025); // 远时快、近时慢

  if (keyMove.w) { // 拉近：沿视线推进，但不越过目标 / 不破 minDistance
    const step = Math.min(speed, dist - controls.minDistance - 1);
    if (step > 0) camera.position.addScaledVector(tmpDir, step);
  }
  if (keyMove.s) { // 拉远：后退，不超 maxDistance
    const step = Math.min(speed, controls.maxDistance - dist - 1);
    if (step > 0) camera.position.addScaledVector(tmpDir, -step);
  }
  if (keyMove.a || keyMove.d) { // 左右平移：沿右向量同时移动相机与目标
    tmpV.crossVectors(tmpDir, camera.up).normalize();
    const dir = keyMove.d ? 1 : -1;
    camera.position.addScaledVector(tmpV, dir * speed);
    controls.target.addScaledVector(tmpV, dir * speed);
  }
}

function updateLinkAnim() {
  if (!linkAnim || linkAnim.cur >= linkAnim.to) return;
  linkAnim.cur = Math.min(linkAnim.to, linkAnim.cur + 0.35);
  drawLinks(linkAnim.center, Math.ceil(linkAnim.cur));
}

function updateGestureFXFrame() {
  if (gestureFX.mode === "one") {
    gestureFX.converge = THREE.MathUtils.lerp(gestureFX.converge, 1, 0.07);
    gestureFX.ringFlare = THREE.MathUtils.lerp(gestureFX.ringFlare, 1, 0.08);
  } else if (gestureFX.mode === "peace") {
    gestureFX.converge = THREE.MathUtils.lerp(gestureFX.converge, 1, 0.06);
    gestureFX.ringFlare = THREE.MathUtils.lerp(gestureFX.ringFlare, 1.65, 0.1);
  } else if (gestureFX.mode === "combo") {
    gestureFX.converge = THREE.MathUtils.lerp(gestureFX.converge, 1, 0.1);
    gestureFX.ringFlare = THREE.MathUtils.lerp(gestureFX.ringFlare, 1.9, 0.12);
  } else if (gestureFX.converge > 0.01) {
    gestureFX.converge = Math.max(0, gestureFX.converge * 0.9 - 0.004);
    gestureFX.ringFlare = THREE.MathUtils.lerp(gestureFX.ringFlare, 1, 0.1);
  }
  if (gestureFX.converge > 0.06) {
    galaxy.rotation.x = THREE.MathUtils.lerp(galaxy.rotation.x, 0, 0.14);
  }
  setConvergeUniforms();
}

function onGestureFX(kind) {
  switch (kind) {
    case "one":
      gestureFX.mode = "one";
      gestureFX.bloom = 0.9;
      gestureFX.spin = 0.004;
      break;
    case "peace":
      gestureFX.mode = "peace";
      gestureFX.bloom = 0.82;
      gestureFX.spin = 0.006;
      break;
    case "combo_pillar_vortex":
    case "combo_burst":
      gestureFX.mode = "combo";
      gestureFX.ringFlare = 1.3;
      gestureFX.bloom = 1.25;
      gestureFX.spin = kind === "combo_pillar_vortex" ? 0.018 : 0.012;
      break;
    case "open":
    case "open_from_fist":
      gestureFX.mode = null;
      gestureFX.bloom = kind === "open_from_fist" ? 0.55 : 0.4;
      break;
    case "fist":
      gestureFX.mode = null;
      gestureFX.bloom = 0.32;
      break;
    case "pinch":
      gestureFX.mode = null;
      gestureFX.bloom = 0.18;
      break;
    case "neutral":
      gestureFX.mode = null;
      gestureFX.bloom = 0.1;
      break;
    case "off":
      gestureFX.mode = null;
      gestureFX.bloom = 0;
      gestureFX.spin = 0;
      gestureFX.converge = 0;
      gestureFX.ringFlare = 1;
      if (dustMat?.uniforms) dustMat.uniforms.scatterFactor.value = 1;
      if (starMat?.uniforms) starMat.uniforms.scatterFactor.value = 1;
      setConvergeUniforms();
      break;
    default:
      break;
  }
}

function stopCamTween() {
  camTween = null;
}

function resetHomeView() {
  camera.position.copy(HOME_CAM);
  controls.target.copy(HOME_TGT);
  galaxy.rotation.set(HOME_GAL_ROT.x, HOME_GAL_ROT.y, HOME_GAL_ROT.z);
  stopCamTween();
}

async function toggleGesture() {
  const btn = document.getElementById("gestureToggle");
  if (!handApi) {
    try {
      handApi = await import("./hand-gesture.js?v=20260626n");
    } catch (e) {
      console.error(e);
      alert(`手势模块加载失败：${e?.message || e}`);
      return;
    }
  }
  if (handApi.isHandGestureActive()) {
    handApi.destroyHandGesture();
    btn?.classList.remove("active");
    document.body.classList.remove("gesture-on");
    rotating = true;
    galaxyRevKey = "";
  } else {
    try {
      resetHomeView();
      rotating = true;
      galaxyRevKey = "";
      await handApi.initHandGesture({ dustMat, starMat, galaxy, camera, controls, onGestureFX, resetHomeView });
      btn?.classList.add("active");
      document.body.classList.add("gesture-on");
    } catch (e) {
      console.error(e);
      const msg = e?.message || String(e);
      alert(`手势启动失败：${msg}\n\n请确认使用 Chrome/Safari，并通过 localhost 访问且已授权摄像头。`);
    }
  }
}

function bindUI() {
  const chipBox = document.getElementById("filters");
  if (!chipBox) return;
  const types = [["all", tt.all], ["scientist", TYPE_META.scientist[lang === "en" ? "en" : "label"]],
    ["book", TYPE_META.book[lang === "en" ? "en" : "label"]], ["achievement", TYPE_META.achievement[lang === "en" ? "en" : "label"]],
    ["building", TYPE_META.building[lang === "en" ? "en" : "label"]]];
  chipBox.innerHTML = types.map(([k, label], idx) =>
    `<button class="filter-chip ${idx === 0 ? "active" : ""}" data-type="${k}">${label}</button>`).join("");
  chipBox.addEventListener("click", (e) => { const b = e.target.closest(".filter-chip"); if (b) { clearSelection(); setFilter(b.dataset.type); } });

  const search = document.getElementById("search");
  const doSearch = () => {
    const q = search.value.trim().toLowerCase(); if (!q) return;
    let i = stars.findIndex((s) => s.name.toLowerCase().includes(q));
    if (i < 0) i = stars.findIndex((s) => (s.tags || []).some((t) => t.toLowerCase().includes(q)) || (s.summary || "").toLowerCase().includes(q));
    if (i >= 0) { if (activeFilter !== "all" && stars[i].type !== activeFilter) setFilter("all"); selectStar(i, true); search.classList.remove("nores"); }
    else { search.classList.add("nores"); search.placeholder = tt.empty; }
  };
  search.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
  document.getElementById("searchGo").addEventListener("click", doSearch);

  document.getElementById("resetView").addEventListener("click", () => {
    exitCruise();
    clearSelection();
    galaxy.rotation.set(HOME_GAL_ROT.x, HOME_GAL_ROT.y, HOME_GAL_ROT.z);
    camTween = { t: 0, camFrom: camera.position.clone(), camTo: HOME_CAM.clone(),
      tgtFrom: controls.target.clone(), tgtTo: HOME_TGT.clone() };
  });
  document.getElementById("cruiseView")?.addEventListener("click", () => {
    if (cruiseActive) exitCruise(); else enterCruise();
  });
  document.getElementById("panelClose").addEventListener("click", clearSelection);
  document.getElementById("panelMinimize")?.addEventListener("click", () => setPanelCollapsed(!panelCollapsed));
  document.getElementById("panelTab")?.addEventListener("click", () => setPanelCollapsed(false));
  document.getElementById("gestureToggle")?.addEventListener("click", toggleGesture);

  renderer.domElement.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });
  let downX = 0, downY = 0;
  renderer.domElement.addEventListener("pointerdown", (e) => { downX = e.clientX; downY = e.clientY; });
  renderer.domElement.addEventListener("click", (e) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
    if (hovered >= 0) selectStar(hovered, true);
    else fishVoid(e.clientX, e.clientY);
  });

  const isTyping = () => {
    const el = document.activeElement;
    return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  };
  window.addEventListener("keydown", (e) => {
    if (e.key === "h" || e.key === "H") document.body.classList.toggle("ui-hidden");
    if (isTyping()) return;
    const k = e.key.toLowerCase();
    if (k === "w" || k === "a" || k === "s" || k === "d") { keyMove[k] = true; e.preventDefault(); }
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    if (k === "w" || k === "a" || k === "s" || k === "d") keyMove[k] = false;
  });
  window.addEventListener("blur", () => { keyMove.w = keyMove.a = keyMove.s = keyMove.d = false; });
  document.getElementById("hideUI")?.addEventListener("click", () => document.body.classList.toggle("ui-hidden"));
}

function fishVoid(x, y) {
  if (!lore.length) return;
  const f = lore[Math.floor(Math.random() * lore.length)];
  const el = document.getElementById("voidCard");
  el.innerHTML = `<b>${f.term}</b><span>${f.text}</span>`;
  const cx = Math.min(Math.max(x || window.innerWidth / 2, 180), window.innerWidth - 180);
  const cy = Math.min(Math.max(y || window.innerHeight / 2, 120), window.innerHeight - 120);
  el.style.left = cx + "px"; el.style.top = cy + "px";
  el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  clearTimeout(voidTimer); voidTimer = setTimeout(() => el.classList.remove("show"), 4600);
}

function syncStarWorlds(force) {
  const r = galaxy.rotation;
  const key = `${r.x.toFixed(5)}|${r.y.toFixed(5)}|${r.z.toFixed(5)}|${bounceAnim ? 1 : 0}`;
  if (!force && key === galaxyRevKey && !bounceAnim) return;
  galaxyRevKey = key;
  galaxy.updateMatrixWorld(true);
  for (let i = 0; i < stars.length; i++) {
    galaxy.localToWorld(stars[i]._world.copy(stars[i]._pos));
  }
}

function pickHover() {
  if (pointer.x < -1.5) return;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(starPoints);
  let found = -1;
  for (const h of hits) { if (!stars[h.index]._dim) { found = h.index; break; } }
  if (found !== hovered) { hovered = found; highlight(); renderer.domElement.style.cursor = hovered >= 0 ? "pointer" : "grab"; }
}

function updateLabels() {
  if (!labelLayer) return;

  if (handApi?.isHandGestureActive?.()) {
    for (let i = 0; i < stars.length; i++) {
      if (stars[i]._label) stars[i]._label.style.opacity = 0;
    }
    return;
  }

  const cfg = focusSet
    ? { ...LABEL_VIEW, max: 99, axisDot: 0.45, rx: 0.55, ry: 0.42 }
    : cruiseActive
    ? { ...LABEL_VIEW, max: isMobile ? 14 : 22, gap: 44, axisDot: 0.2,
        rx: 0.85, ry: 0.7, distMin: 0, distMax: 2000 }
    : { ...LABEL_VIEW, max: isMobile ? 10 : LABEL_VIEW.max, gap: isMobile ? 44 : LABEL_VIEW.gap,
        rx: isMobile ? 0.34 : LABEL_VIEW.rx, ry: isMobile ? 0.26 : LABEL_VIEW.ry };

  const scrCx = window.innerWidth * 0.5;
  const scrCy = window.innerHeight * 0.52;
  const vdx = tmpDir.copy(controls.target).sub(camera.position).normalize().x;
  const vdy = tmpDir.y;
  const vdz = tmpDir.z;
  const camX = camera.position.x;
  const camY = camera.position.y;
  const camZ = camera.position.z;
  const candidates = [];

  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    if (!s._label) continue;
    const force = i === selected || i === hovered || (focusSet && focusSet.has(i));

    if (!force) {
      if (focusSet) continue;
      if (s._dim) continue;
      if (s.type === "achievement" && !cruiseActive) continue;
    }

    const wx = s._world.x, wy = s._world.y, wz = s._world.z;
    const dist = Math.hypot(wx - camX, wy - camY, wz - camZ);
    const len = dist || 1;
    const axisDot = ((wx - camX) * vdx + (wy - camY) * vdy + (wz - camZ) * vdz) / len;

    tmpV.set(wx, wy, wz).project(camera);
    if (tmpV.z > 1) continue;

    const ndcX = tmpV.x;
    const ndcY = tmpV.y;
    let funnel;
    if (cruiseActive) {
      // 漫游：不限制屏幕中心区域，只要在画面内即可，纯按「离镜头近」取
      if (!force && (Math.abs(ndcX) > 1.02 || Math.abs(ndcY) > 1.02)) continue;
      if (!force && axisDot < 0) continue;
      funnel = 1;
    } else {
      const ell = Math.hypot(ndcX / cfg.rx, ndcY / cfg.ry);
      funnel = ell <= 1 ? 1 : Math.max(0, 1 - (ell - 1) / cfg.soft);
      if (dist < cfg.distMin || dist > cfg.distMax) funnel *= 0.45;
      if (!force && axisDot < cfg.axisDot) continue;
      if (!force && funnel < 0.06) continue;
    }

    const x = (ndcX * 0.5 + 0.5) * window.innerWidth;
    const y = (-ndcY * 0.5 + 0.5) * window.innerHeight;
    const scrDist = Math.hypot(x - scrCx, y - scrCy);
    const pri = s.type === "achievement" ? 2 : (s.type === "scientist" || s.type === "building" ? 0 : 1);

    candidates.push({ i, x, y, dist, scrDist, funnel, axisDot, pri, force });
  }

  candidates.sort((a, b) => {
    if (a.force !== b.force) return a.force ? -1 : 1;
    if (cruiseActive) return a.dist - b.dist;
    return (a.pri - b.pri) || (a.scrDist - b.scrDist) || (a.dist - b.dist);
  });

  const show = new Map();
  const placed = [];

  for (const o of candidates) {
    if (!o.force && show.size >= cfg.max) break;
    if (!o.force) {
      let ok = true;
      for (const p of placed) {
        if (Math.hypot(o.x - p.x, o.y - p.y) < cfg.gap) { ok = false; break; }
      }
      if (!ok) continue;
    }
    show.set(o.i, o);
    placed.push({ x: o.x, y: o.y });
  }

  // 漫游：算出当前可见星里最近的距离，作为「最亮」基准，越远越淡
  let cruiseDmin = Infinity;
  if (cruiseActive) {
    for (const o of show.values()) if (!o.force) cruiseDmin = Math.min(cruiseDmin, o.dist);
    if (!isFinite(cruiseDmin)) cruiseDmin = 0;
  }

  for (let i = 0; i < stars.length; i++) {
    const el = stars[i]._label;
    if (!el) continue;
    const o = show.get(i);
    if (!o) { el.style.opacity = 0; continue; }
    const isHot = o.i === selected || o.i === hovered;
    const isRel = focusSet && focusSet.has(o.i) && o.i !== selected;
    el.classList.remove("spotlight");
    el.style.transform = `translate(-50%,-150%) translate(${o.x}px,${o.y}px)`;
    let opv;
    if (isHot) opv = 1;
    else if (cruiseActive) {
      // 离镜头最近的前景星最亮，越远越淡（红框那片近星会亮起）
      let near = 1 - (o.dist - cruiseDmin) / 380;
      near = Math.min(1, Math.max(0, near));
      opv = Math.min(0.96, near);
    } else {
      const fade = 0.5 + o.funnel * 0.45 + Math.min(o.axisDot, 1) * 0.12;
      opv = isRel ? 0.92 : Math.min(0.96, fade);
    }
    el.style.opacity = opv;
    el.classList.toggle("hot", isHot);
    el.classList.toggle("rel", isRel);
  }
}

function onResize() {
  if (!camera || !renderer || !composer) return;
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

function renderFrame() {
  if (!renderer || !scene || !camera) return;
  try {
    if (composer) composer.render();
    else renderer.render(scene, camera);
  } catch (e) {
    console.warn("composer.render fallback:", e);
    renderer.render(scene, camera);
  }
}

function animate() {
  requestAnimationFrame(animate);
  frameN++;
  try {
  const handOn = handApi?.isHandGestureActive?.();
  if (handOn) handApi.updateGestureFrame(performance.now());

  // 漫游：镜头钉死不动（进场 tween 结束后保持），银河靠下面的自转转动
  if (rotating && !handOn) galaxy.rotation.z += 0.00052;
  if (gestureFX.spin > 0.001) {
    galaxy.rotation.z += gestureFX.spin;
    gestureFX.spin *= 0.94;
  }
  gestureFX.bloom *= 0.9;
  if (bloomPass) {
    const bloomBase = handOn ? (isMobile ? 0.52 : 0.7) : (isMobile ? 0.58 : BASE_BLOOM);
    bloomPass.strength = bloomBase + gestureFX.bloom * (handOn ? 0.7 : 0.9);
  }
  updateGestureFXFrame();

  updateTween(); updateLinkAnim(); updateBounce();
  if (!handOn) updateKeyMove();
  const needWorldSync = bounceAnim || selected >= 0 || !handOn || frameN % 4 === 0;
  if (needWorldSync) syncStarWorlds(!!bounceAnim || handOn || (rotating && !handOn));
  controls.update();
  if (!handOn && frameN % 2 === 0) pickHover();
  updateLabels();
  if (linkLine) linkLine.material.opacity = 0.28 + Math.sin(performance.now() * 0.003) * 0.16;
  renderFrame();
  } catch (e) {
    console.error("animate:", e);
  }
}
