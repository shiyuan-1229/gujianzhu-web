/**
 * 故宫专题 BGM + 胶片
 * - 北京故宫详情页：播放 assets/bgm.mp3 + assets/film-reel.png
 * - 御花园详情页：播放 assets/yuhuayuan-bgm.mp3 + assets/yuhuayuan-film.png
 * - 离开对应详情页后，淡出停止并隐藏胶片
 */
(function () {
  const FLAG_ON = "__BEIJING_BGM_ON__";
  const KEY_PENDING = "__BEIJING_BGM_PENDING__";

  const state = {
    inited: false,
    audio: null,
    film: null,
    currentScene: "",
    fadeTimer: null,
    volume: 0.28,
  };

  const SCENES = {
    forbidden: {
      key: "forbidden",
      match: (path, building) => path.endsWith("/detail.html") && (building === "北京故宫"),
      audio: "./assets/bgm.mp3",
      film: "./assets/film-reel.png",
      volume: 0.28,
    },
    yuhuayuan: {
      key: "yuhuayuan",
      match: (path, building) => path.endsWith("/detail.html") && (
        building === "故宫御花园" || building === "御花园" || building.includes("御花园")
      ),
      audio: "./assets/yuhuayuan-bgm.mp3",
      film: "./assets/yuhuayuan-film.png",
      volume: 0.28,
    },
  };

  function getBuildingFromUrl() {
    const params = new URLSearchParams(window.location.search || "");
    const raw = (params.get("building") || "").trim();
    if (!raw) return "";
    try {
      return decodeURIComponent(raw).trim();
    } catch (_) {
      return raw;
    }
  }

  function getScene() {
    const path = (window.location.pathname || "").toLowerCase();
    const building = getBuildingFromUrl();
    if (SCENES.forbidden.match(path, building)) return SCENES.forbidden;
    if (SCENES.yuhuayuan.match(path, building)) return SCENES.yuhuayuan;
    return null;
  }

  function readFlag(name) {
    try {
      return sessionStorage.getItem(name) === "1";
    } catch (_) {
      return false;
    }
  }

  function writeFlag(name, val) {
    try {
      sessionStorage.setItem(name, val ? "1" : "0");
    } catch (_) {
      // ignore
    }
  }

  function ensureStyle() {
    if (document.getElementById("filmReelStyle")) return;
    const style = document.createElement("style");
    style.id = "filmReelStyle";
    style.textContent = `
      .film-reel {
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 120px;
        height: 120px;
        z-index: 9999;
        display: none;
        opacity: 0;
        transform: scale(0.8) rotate(0deg);
        transition: opacity .4s ease, transform .4s ease;
        pointer-events: none;
      }
      .film-reel.visible {
        display: block;
        opacity: 1;
        transform: scale(1) rotate(0deg);
      }
      .film-reel .film-disc {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        overflow: hidden;
      }
      .film-reel .film-disc img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
        border-radius: 50%;
        pointer-events: none;
      }
      .film-reel.spinning { animation: filmReelSpin 10s linear infinite; }
      @keyframes filmReelSpin {
        from { transform: scale(1) rotate(0deg); }
        to { transform: scale(1) rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureElements() {
    if (state.inited) return;
    ensureStyle();

    state.audio = new Audio();
    state.audio.loop = true;
    state.audio.preload = "auto";
    state.audio.setAttribute("playsinline", "true");

    state.film = document.createElement("div");
    state.film.className = "film-reel";
    state.film.setAttribute("aria-hidden", "true");
    state.film.style.display = "none";
    document.body.appendChild(state.film);

    state.inited = true;
  }

  function renderFilm(src) {
    if (!state.film) return;
    state.film.innerHTML = `
      <div class="film-disc" aria-hidden="true">
        <img src="${src}" alt="" />
      </div>
    `;
  }

  function showFilm() {
    if (!state.film) return;
    state.film.style.display = "block";
    state.film.classList.add("visible", "spinning");
  }

  function hideFilm() {
    if (!state.film) return;
    state.film.classList.remove("visible", "spinning");
    state.film.style.display = "none";
  }

  function clearFade() {
    if (state.fadeTimer) {
      window.clearInterval(state.fadeTimer);
      state.fadeTimer = null;
    }
  }

  function fadeOutAndStop() {
    if (!state.audio) return;
    clearFade();

    if (state.audio.paused) {
      state.audio.currentTime = 0;
      hideFilm();
      return;
    }

    const startVol = Number(state.audio.volume || state.volume || 0.28);
    let i = 0;
    const steps = 10;
    const stepMs = 50;

    state.fadeTimer = window.setInterval(function () {
      i += 1;
      const v = Math.max(0, startVol * (1 - i / steps));
      state.audio.volume = v;
      if (i >= steps) {
        clearFade();
        state.audio.pause();
        state.audio.currentTime = 0;
        state.audio.volume = state.volume;
        hideFilm();
      }
    }, stepMs);
  }

  function startScene(scene) {
    if (!scene) return Promise.resolve(false);
    ensureElements();
    clearFade();

    // 场景切换时先重设资源
    if (state.currentScene !== scene.key) {
      state.currentScene = scene.key;
      state.audio.src = scene.audio;
      state.audio.load();
      renderFilm(scene.film);
    }

    state.volume = scene.volume;
    state.audio.volume = scene.volume;
    state.audio.muted = false;

    return state.audio.play().then(() => {
      showFilm();
      return true;
    }).catch(() => false);
  }

  function stopAll() {
    writeFlag(FLAG_ON, false);
    writeFlag(KEY_PENDING, false);
    state.currentScene = "";
    fadeOutAndStop();
  }

  function initByPage() {
    ensureElements();
    const scene = getScene();

    // 非目标页面：按你的要求立即淡出并消失
    if (!scene) {
      stopAll();
      return;
    }

    // 目标页面（北京故宫/御花园）：直接开始
    writeFlag(FLAG_ON, true);
    writeFlag(KEY_PENDING, false);
    startScene(scene).then((ok) => {
      if (!ok) {
        const unlock = function () {
          startScene(scene).then((s) => {
            if (s) {
              document.removeEventListener("pointerdown", unlock, true);
              document.removeEventListener("keydown", unlock, true);
            }
          });
        };
        document.addEventListener("pointerdown", unlock, true);
        document.addEventListener("keydown", unlock, true);
      }
    });
  }

  // 首页点北京时调用：只打待启动标记（不立即播放）
  function triggerBeijingBgmFilm() {
    writeFlag(KEY_PENDING, true);
    return Promise.resolve(true);
  }

  function stopBeijingBgmFilm() {
    stopAll();
  }

  function setBeijingBGMVolume(v) {
    const safe = Math.max(0, Math.min(1, Number(v)));
    state.volume = safe;
    if (state.audio) state.audio.volume = safe;
  }

  window.initBeijingBgmFilmFeature = initByPage;
  window.triggerBeijingBgmFilm = triggerBeijingBgmFilm;
  window.stopBeijingBgmFilm = stopBeijingBgmFilm;
  window.setBeijingBGMVolume = setBeijingBGMVolume;

  window.playBeijingBGM = triggerBeijingBgmFilm;
  window.stopBeijingBGM = stopBeijingBgmFilm;

  window.addEventListener("load", initByPage);
})();
