/**
 * MediaPipe HandLandmarker · 手势造型（1️⃣星粒行星 / ✌️星环扩张 + 散聚星）
 */
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

const MP_ESM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";
const MP_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MP_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";
let refs = null;
const camDir = { x: 0, y: 0, z: 1 };
let handLostSince = 0;
let comboTimer = null;
const HAND_LOST_MS = 320;
const DETECT_MS = 42;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

const STATE_UI = {
  loading: { icon: "⏳", text: "" },
  none: { icon: "🤚", text: "" },
  one: { icon: "☝️", text: "" },
  peace: { icon: "✌️", text: "" },
  open: { icon: "✋", text: "" },
  fist: { icon: "✊", text: "" },
  neutral: { icon: "🖐", text: "" },
  pinch: { icon: "🤏", text: "" },
  combo: { icon: "💫", text: "" },
};

let active = false;
let handLandmarker = null;
let video = null;
let ctx = null;
let preview = null;
let hintEl = null;
let iconEl = null;
let nameEl = null;
let mediaStream = null;
let lastDetect = 0;
let lastLandmarks = null;
let previewTick = 0;

let smoothOpen = 0.2;
let smoothWristX = 0.5;
let smoothWristY = 0.5;
let smoothPinch = 0.15;
let gestureState = "loading";
let prevGestureState = "none";
let fistHoldSince = 0;
let oneHoldSince = 0;

let targetDust = 1.0;
let targetStar = 1.0;
let currentDust = 1.0;
let currentStar = 1.0;
let baseCamDist = 620;
let baseGalRot = { x: 0, y: 0, z: 0 };
const CAM_MIN = 400;
const CAM_MAX = 1020;
const CAM_ZOOM_RANGE = 260;

function setStatus(key) {
  if (!hintEl) return;
  const ui = STATE_UI[key] || STATE_UI.none;
  if (iconEl) iconEl.textContent = ui.icon;
  if (nameEl) {
    nameEl.textContent = "";
    nameEl.style.display = "none";
  }
}

function fingerExt(hand, tipIdx, mcpIdx) {
  const tip = hand[tipIdx];
  const mcp = hand[mcpIdx];
  const wrist = hand[0];
  return Math.hypot(tip.x - wrist.x, tip.y - wrist.y) / Math.max(0.07, Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y));
}

function computeOpenness(hand) {
  const wrist = hand[0];
  const tips = [4, 8, 12, 16, 20].map((i) => hand[i]);
  return tips.reduce((s, t) => s + Math.hypot(t.x - wrist.x, t.y - wrist.y), 0) / 5;
}

function isPinching(hand) {
  const thumb = hand[4];
  const index = hand[8];
  const dist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
  return dist < 0.078 && fingerExt(hand, 12, 9) > 1.0;
}

/** 1️⃣ 食指单立，其余收拢 */
function isOne(hand) {
  const indexUp = fingerExt(hand, 8, 5) > 1.05;
  const middleDown = fingerExt(hand, 12, 9) < 1.12;
  const ringDown = fingerExt(hand, 16, 13) < 1.12;
  const pinkyDown = fingerExt(hand, 20, 17) < 1.15;
  const thumbIn = fingerExt(hand, 4, 2) < 1.4;
  return indexUp && middleDown && ringDown && pinkyDown && thumbIn;
}

/** ✌️ 食中二指张开，其余收拢 */
function isPeace(hand) {
  const indexUp = fingerExt(hand, 8, 5) > 1.05;
  const middleUp = fingerExt(hand, 12, 9) > 1.05;
  const ringDown = fingerExt(hand, 16, 13) < 1.1;
  const pinkyDown = fingerExt(hand, 20, 17) < 1.12;
  const spread = Math.hypot(hand[8].x - hand[12].x, hand[8].y - hand[12].y);
  return indexUp && middleUp && ringDown && pinkyDown && spread > 0.03;
}

function classifyGesture(hand) {
  if (isPinching(hand)) return "pinch";
  if (isOne(hand)) return "one";
  if (isPeace(hand)) return "peace";
  const open = computeOpenness(hand);
  if (open < 0.16) return "fist";
  if (open > 0.22) return "open";
  return "neutral";
}

function scatterTargets(state) {
  switch (state) {
    case "combo": return { dust: 1.0, star: 1.0 };
    case "one": return { dust: 1.0, star: 1.0 };
    case "peace": return { dust: 1.0, star: 1.0 };
    case "open": return { dust: 2.7, star: 1.7 };
    case "fist": return { dust: 0.1, star: 0.07 };
    case "pinch": return { dust: 0.88, star: 0.78 };
    default: return { dust: 1.0, star: 1.0 };
  }
}

function fireGestureFX(kind) {
  refs?.onGestureFX?.(kind);
}

function transitionTo(next) {
  if (next === gestureState) return;

  const now = performance.now();

  /* 连招：1️⃣ → ✌️ 柱开双臂 */
  if (prevGestureState === "one" && next === "peace" && oneHoldSince && now - oneHoldSince < 1400) {
    next = "combo";
    fireGestureFX("combo_pillar_vortex");
    setStatus("combo");
  } else if (prevGestureState === "fist" && next === "open" && fistHoldSince && now - fistHoldSince > 420) {
    next = "combo";
    fireGestureFX("combo_burst");
    setStatus("combo");
  } else if (next === "one") {
    oneHoldSince = now;
    fireGestureFX("one");
    setStatus("one");
  } else if (next === "peace") {
    fireGestureFX("peace");
    setStatus("peace");
  } else if (next === "open") {
    fireGestureFX(prevGestureState === "fist" ? "open_from_fist" : "open");
    setStatus("open");
  } else if (next === "fist") {
    fistHoldSince = now;
    fireGestureFX("fist");
    setStatus("fist");
  } else if (next === "pinch") {
    fireGestureFX("pinch");
    setStatus("pinch");
  } else if (next === "neutral") {
    fireGestureFX("neutral");
    setStatus("neutral");
  }

  prevGestureState = gestureState;
  gestureState = next;
  const t = scatterTargets(next);
  targetDust = t.dust;
  targetStar = t.star;

  if (next === "combo") {
    if (comboTimer) clearTimeout(comboTimer);
    comboTimer = setTimeout(() => {
      comboTimer = null;
      if (gestureState === "combo") {
        gestureState = "peace";
        const tt = scatterTargets("peace");
        targetDust = tt.dust;
        targetStar = tt.star;
        fireGestureFX("peace");
        setStatus("peace");
      }
    }, 900);
  }
}

let videoMap = { vw: 640, vh: 480 };

function syncPreviewSize() {
  if (!video || !preview || !video.videoWidth) return;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (preview.width !== vw || preview.height !== vh) {
    preview.width = vw;
    preview.height = vh;
  }
  videoMap = { vw, vh };
}

/** 镜像后的画布坐标（与自拍预览一致） */
function lmToCanvas(lm) {
  const { vw, vh } = videoMap;
  return { x: (1 - lm.x) * vw, y: lm.y * vh };
}

function updateFistChargeUI(now) {
  if (gestureState !== "fist" || !fistHoldSince) return;
  setStatus("fist");
}

function drawPreview(landmarks) {
  if (!ctx || !preview || !video) return;
  if (video.videoWidth < 1) return;
  syncPreviewSize();
  const w = preview.width;
  const h = preview.height;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();
  if (landmarks?.length) {
    ctx.strokeStyle = "rgba(232,184,75,0.95)";
    ctx.lineWidth = Math.max(2, w / 160);
    for (const [a, b] of HAND_CONNECTIONS) {
      const p1 = lmToCanvas(landmarks[a]);
      const p2 = lmToCanvas(landmarks[b]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,230,160,1)";
    const r = Math.max(3, w / 120);
    for (const p of landmarks) {
      const c = lmToCanvas(p);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function applyScatter(dust, star) {
  if (!refs) return;
  const { dustMat, starMat } = refs;
  if (dustMat?.uniforms?.scatterFactor) dustMat.uniforms.scatterFactor.value = dust;
  if (starMat?.uniforms?.scatterFactor) starMat.uniforms.scatterFactor.value = star;
}

export function updateGestureFrame(now) {
  if (!active || !refs) return;

  /* 识别优先：避免后续逻辑异常导致 detect 跳帧 */
  if (now - lastDetect >= DETECT_MS && video && handLandmarker && video.readyState >= 2 && video.videoWidth > 0) {
    lastDetect = now;
    try {
      const results = handLandmarker.detectForVideo(video, now);
      processLandmarks(results.landmarks?.[0] || null, now);
    } catch (e) {
      console.warn("detectForVideo:", e);
    }
  }

  const lerpK = gestureState === "combo" ? 0.24 : (gestureState === "one" || gestureState === "peace" ? 0.2 : 0.18);
  currentDust += (targetDust - currentDust) * lerpK;
  currentStar += (targetStar - currentStar) * lerpK;
  applyScatter(currentDust, currentStar);

  const { galaxy, camera, controls } = refs;
  if (gestureState !== "none" && gestureState !== "loading") {
    const rotY = (smoothWristX - 0.5) * 3.2;
    const planetMode = gestureState === "one" || gestureState === "peace" || gestureState === "combo";
    galaxy.rotation.y = baseGalRot.y + rotY;
    if (planetMode) {
      galaxy.rotation.x = lerp(galaxy.rotation.x, 0, 0.18);
    } else {
      galaxy.rotation.x = baseGalRot.x + (smoothWristY - 0.5) * 1.45;
    }
    if (gestureState === "combo") galaxy.rotation.z += 0.007;
    else if (gestureState === "peace") galaxy.rotation.z += 0.003;
    else if (gestureState === "one") galaxy.rotation.z += 0.001;
  }

  if (camera && controls && gestureState !== "none" && gestureState !== "loading") {
    let dist = baseCamDist;
    if (gestureState === "pinch") {
      const t = (smoothPinch - 0.06) / 0.1;
      dist = baseCamDist - t * CAM_ZOOM_RANGE;
    }
    dist = Math.min(CAM_MAX, Math.max(CAM_MIN, dist));
    const tgt = controls.target;
    camDir.x = camera.position.x - tgt.x;
    camDir.y = camera.position.y - tgt.y;
    camDir.z = camera.position.z - tgt.z;
    const len = Math.hypot(camDir.x, camDir.y, camDir.z) || 1;
    camera.position.set(
      tgt.x + (camDir.x / len) * dist,
      tgt.y + (camDir.y / len) * dist,
      tgt.z + (camDir.z / len) * dist,
    );
  }

  updateFistChargeUI(now);
  if (++previewTick % 2 === 0) drawPreview(lastLandmarks);
}

function processLandmarks(landmarks, now) {
  lastLandmarks = landmarks;

  if (!landmarks?.length) {
    if (!handLostSince) handLostSince = now;
    if (now - handLostSince < HAND_LOST_MS) return;
    handLostSince = 0;
    if (gestureState !== "none") {
      prevGestureState = gestureState;
      gestureState = "none";
      targetDust = 1.0;
      targetStar = 1.0;
      fistHoldSince = 0;
      oneHoldSince = 0;
      if (refs?.controls) refs.controls.enabled = true;
      fireGestureFX("off");
      setStatus("none");
    }
    return;
  }

  handLostSince = 0;

  if (refs?.controls) refs.controls.enabled = false;

  const next = classifyGesture(landmarks);
  transitionTo(next);

  const wrist = landmarks[0];
  const mx = 1 - wrist.x;
  smoothWristX = smoothWristX * 0.5 + mx * 0.5;
  smoothWristY = smoothWristY * 0.5 + wrist.y * 0.5;
  const thumb = landmarks[4];
  const index = landmarks[8];
  smoothPinch = smoothPinch * 0.42 + Math.hypot(thumb.x - index.x, thumb.y - index.y) * 0.58;
}

async function createLandmarker(HandLandmarker, FilesetResolver) {
  const vision = await FilesetResolver.forVisionTasks(MP_WASM);
  const opts = {
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.55,
    minTrackingConfidence: 0.55,
  };
  try {
    return await HandLandmarker.createFromOptions(vision, {
      ...opts,
      baseOptions: { modelAssetPath: MP_MODEL, delegate: "GPU" },
    });
  } catch {
    return HandLandmarker.createFromOptions(vision, {
      ...opts,
      baseOptions: { modelAssetPath: MP_MODEL, delegate: "CPU" },
    });
  }
}

async function waitForVideoReady(v, timeoutMs = 8000) {
  const t0 = performance.now();
  while (performance.now() - t0 < timeoutMs) {
    if (v.readyState >= 2 && v.videoWidth > 0) return;
    await new Promise((r) => setTimeout(r, 80));
  }
  throw new Error("摄像头画面未就绪");
}

export async function initHandGesture(options) {
  if (active) return;

  refs = options;
  preview = document.getElementById("mpPreview");
  hintEl = document.getElementById("gestureHint");
  iconEl = document.getElementById("gestureIcon");
  nameEl = document.getElementById("gestureName");
  video = document.getElementById("mpCam");
  if (!preview || !video) throw new Error("缺少摄像头 DOM");

  ctx = preview.getContext("2d", { alpha: false, desynchronized: true });
  preview.style.display = "block";
  if (hintEl) hintEl.style.display = "flex";
  setStatus("loading");
  gestureState = "loading";

  try { refs.resetHomeView?.(); } catch (e) { console.warn("resetHomeView:", e); }
  baseCamDist = refs.camera.position.distanceTo(refs.controls.target);
  baseGalRot = { x: refs.galaxy.rotation.x, y: refs.galaxy.rotation.y, z: refs.galaxy.rotation.z };
  smoothWristX = 0.5;
  smoothWristY = 0.5;
  smoothPinch = 0.1;
  prevGestureState = "none";
  fistHoldSince = 0;
  oneHoldSince = 0;
  video.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;";

  setStatus("loading");
  const { HandLandmarker, FilesetResolver } = await import(MP_ESM);
  handLandmarker = await createLandmarker(HandLandmarker, FilesetResolver);

  setStatus("loading");
  mediaStream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 640, min: 480 },
      height: { ideal: 480, min: 360 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: false,
  });
  video.srcObject = mediaStream;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  await video.play();
  await waitForVideoReady(video);
  syncPreviewSize();

  if (refs.controls) refs.controls.enabled = true;
  active = true;
  gestureState = "none";
  prevGestureState = "none";
  lastDetect = 0;
  setStatus("none");
}

export function destroyHandGesture() {
  active = false;
  lastLandmarks = null;
  handLostSince = 0;
  if (comboTimer) { clearTimeout(comboTimer); comboTimer = null; }

  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  if (video) {
    video.srcObject = null;
    video.style.cssText = "display:none;";
  }

  handLandmarker?.close?.();
  handLandmarker = null;

  if (refs?.controls) refs.controls.enabled = true;
  refs?.onGestureFX?.("off");
  applyScatter(1.0, 1.0);
  currentDust = 1.0;
  currentStar = 1.0;
  targetDust = 1.0;
  targetStar = 1.0;

  if (preview) {
    preview.style.display = "none";
    ctx?.clearRect(0, 0, preview.width, preview.height);
  }
  if (hintEl) hintEl.style.display = "none";
  refs = null;
}

export function isHandGestureActive() {
  return active;
}
