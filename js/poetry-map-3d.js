/**
 * 诗词山河 · MapLibre 卫星 3D 地形 + 垂挂诗签
 * 地形方案：splendid-china-3d 在线版（Esri 卫星 + Terrarium DEM）
 */
import {
  maplibregl,
  initPoetryChinaMap,
  initScsInsetMap,
  flyToDefaultView,
  setMapInteraction,
  preloadChinaGeo
} from "./poetry-china-maplibre.js?v=66";

var mapData = null;
var isOpen = false;
var isPoemOpen = false;
var projectData = null;

var layer, canvasHost, hudSub, loadingEl;
var poemStage, poemBack, poemTitle, poemMeta, poemBody, poemTag, buildingLink;
var toggleBtn, closeBtn, resetBtn, navPoetry;

var map = null;
var scsInsetMap = null;
var mapMarkers = [];
var scsInsetHost = null;
var scsInsetWrap = null;

var ORBIT_CLICK_PX = 8;
var FORBIDDEN_CIPAI = { 鹊桥仙: true, 隔帘听: true, 驻马听: true, 红窗听: true };

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function displayBuildingName(name) {
  return String(name || "").replace(/^北京/, "");
}

function verticalPoemTitle(title) {
  var t = String(title || "")
    .replace(/^[^·《]+·/, "")
    .replace(/（.*?）/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/四首.*$/, "")
    .trim();
  if (t.length > 18) return t.slice(0, 17) + "…";
  return t;
}

function getSiteLang() {
  if (typeof resolveSiteLang === "function") return resolveSiteLang();
  var m = location.search.match(/[?&]lang=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : "zh";
}

function getBuildingDetailUrl(buildingName) {
  var lang = getSiteLang();
  return (
    "./detail.html?building=" +
    encodeURIComponent(buildingName) +
    "&lang=" +
    encodeURIComponent(lang)
  );
}

function normalizeMapData(raw) {
  if (!raw) return { subtitle: "暂无数据", buildings: [] };
  return {
    title: raw.title,
    subtitle: raw.subtitle || ("诗词山河 · " + (raw.buildings || []).length + " 处古建"),
    buildings: raw.buildings || [],
    meta: raw.meta || {},
  };
}

function yieldFrame() {
  return new Promise(function (resolve) {
    requestAnimationFrame(function () {
      setTimeout(resolve, 0);
    });
  });
}

function loadFallbackDataScript() {
  return new Promise(function (resolve, reject) {
    if (window.POETRY_LANDSCAPE_DATA) {
      resolve();
      return;
    }
    var s = document.createElement("script");
    s.src = "./js/poetry-landscape-data.js?v=66";
    s.async = true;
    s.onload = function () {
      resolve();
    };
    s.onerror = function () {
      reject(new Error("fallback data missing"));
    };
    document.body.appendChild(s);
  });
}

function loadData() {
  return fetch("/api/poetry-landscape?scope=extended", { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (d) {
      projectData = normalizeMapData(d);
      return projectData;
    })
    .catch(function () {
      return loadFallbackDataScript()
        .then(function () {
          if (window.POETRY_LANDSCAPE_DATA) {
            projectData = normalizeMapData(window.POETRY_LANDSCAPE_DATA);
            return projectData;
          }
          projectData = { subtitle: "暂无诗词数据", buildings: [] };
          return projectData;
        })
        .catch(function () {
          projectData = { subtitle: "暂无诗词数据", buildings: [] };
          return projectData;
        });
    });
}

function getBuildingLngLat(name, buildingFromApi) {
  var src = (window.POETRY_MAP_POSITIONS && window.POETRY_MAP_POSITIONS[name]) || null;
  if (src && src.lng != null && src.lat != null) {
    return { lng: src.lng, lat: src.lat };
  }
  if (buildingFromApi && buildingFromApi.lng != null && buildingFromApi.lat != null) {
    return { lng: buildingFromApi.lng, lat: buildingFromApi.lat };
  }
  return { lng: 104.1, lat: 35.5 };
}

function bindTap(el, onTap) {
  var sx = 0;
  var sy = 0;
  el.addEventListener("pointerdown", function (e) {
    e.stopPropagation();
    sx = e.clientX;
    sy = e.clientY;
  });
  el.addEventListener("click", function (e) {
    e.stopPropagation();
    if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > ORBIT_CLICK_PX) return;
    onTap(e);
  });
}

function buildLabelElement(b, p, onTap) {
  var root = document.createElement("div");
  root.className = "poetry-map-3d__label-3d poetry-map-3d__label-map";

  var pin = document.createElement("div");
  pin.className = "poetry-map-3d__label-pin";
  pin.setAttribute("aria-hidden", "true");

  var scroll = document.createElement("div");
  scroll.className = "poetry-map-3d__label-scroll";
  scroll.setAttribute(
    "title",
    displayBuildingName(b.name) + (p ? " · " + p.title + " · " + p.author : "")
  );

  if (p) {
    scroll.innerHTML =
      '<span class="poetry-map-3d__hang-title">' +
      escapeHtml(verticalPoemTitle(p.title)) +
      "</span>" +
      '<span class="poetry-map-3d__hang-author">' +
      escapeHtml(p.author || "") +
      "</span>";
  } else {
    scroll.innerHTML = '<span class="poetry-map-3d__hang-title">暂无关联诗</span>';
  }

  var stringEl = document.createElement("div");
  stringEl.className = "poetry-map-3d__label-string";
  stringEl.setAttribute("aria-hidden", "true");

  root.appendChild(scroll);
  root.appendChild(stringEl);
  root.appendChild(pin);
  bindTap(root, onTap);
  return root;
}

function clearMarkers() {
  mapMarkers.forEach(function (m) { m.remove(); });
  mapMarkers = [];
}

function hasMapPosition(name) {
  var src = window.POETRY_MAP_POSITIONS && window.POETRY_MAP_POSITIONS[name];
  return !!(src && src.lng != null && src.lat != null);
}

function renderMarkers() {
  if (!map || !projectData) return;
  clearMarkers();
  var buildings = projectData.buildings || [];
  var index = 0;

  function addNextBatch() {
    if (!map || !isOpen) return;
    var end = Math.min(index + 4, buildings.length);
    for (; index < end; index += 1) {
      var b = buildings[index];
      if (!hasMapPosition(b.name)) continue;
      var p = (b.poems_preview || [])[0];
      if (!p || p.match_tier !== "strict") continue;
      var onTap = function (building, preview) {
        return function () {
          if (preview) showDetail(preview.id, building.name, building.province);
          else openBuildingEmpty(building.name, building.province);
        };
      };
      var el = buildLabelElement(b, p, onTap(b, p));
      var ll = getBuildingLngLat(b.name, b);
      var marker = new maplibregl.Marker({
        element: el,
        anchor: "bottom",
        offset: [0, -6]
      })
        .setLngLat([ll.lng, ll.lat])
        .addTo(map);
      mapMarkers.push(marker);
    }
    if (index < buildings.length) {
      scheduleIdle(addNextBatch, 40);
    }
  }

  addNextBatch();
}

function setLoading(on) {
  if (!layer) return;
  if (on) layer.classList.add("is-loading");
  else layer.classList.remove("is-loading");
}

function showLayerShell() {
  isOpen = true;
  layer.classList.add("is-open");
  layer.classList.add("is-satellite-terrain");
  layer.setAttribute("aria-hidden", "false");
  document.body.classList.add("poetry-map-open");
  document.body.style.overflow = "hidden";
  if (toggleBtn) toggleBtn.classList.add("is-active");
  setLoading(true);
}

function hideLayerShell() {
  if (layer) {
    layer.classList.remove("is-open");
    layer.classList.remove("is-satellite-terrain");
    layer.classList.remove("is-loading");
    layer.setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("poetry-map-open");
  document.body.style.overflow = "";
  if (toggleBtn) toggleBtn.classList.remove("is-active");
}

function notifyExplorePage(eventName, detail) {
  if (!document.body.classList.contains("poetry-explore-page")) return;
  if (eventName === "poetry-map-ready") {
    document.dispatchEvent(new CustomEvent("poetry-map-ready"));
    return;
  }
  document.dispatchEvent(new CustomEvent("poetry-map-error", { detail: detail || "" }));
}

function finishOpen() {
  var isExplorePage = document.body.classList.contains("poetry-explore-page");

  setLoading(false);
  if (hudSub) {
    hudSub.textContent =
      "仅中国版图 · 左键拖拽 · 右键360°旋转 · 滚轮缩放 · 南海诸岛见右下";
  }

  if (isExplorePage) {
    notifyExplorePage("poetry-map-ready");
    scheduleIdle(function () {
      if (!isOpen) return;
      renderMarkers();
      setControlsEnabled(true);
      resetView(false);
      closePoemStage();
      onResize();
    }, 80);
  } else {
    renderMarkers();
    setControlsEnabled(true);
    resetView(false);
    closePoemStage();
    onResize();
    if (map) {
      map.once("idle", function () {
        renderMarkers();
        onResize();
      });
    }
  }

  scheduleIdle(function () {
    initScsInset();
  }, isExplorePage ? 5000 : 2200);
}

function scheduleIdle(fn, delayMs) {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(fn, { timeout: delayMs || 2000 });
  } else {
    setTimeout(fn, Math.min(delayMs || 2000, 800));
  }
}

function warmupAssets() {
  loadData().catch(function () {});
  preloadChinaGeo().catch(function () {});
}

function purgeCanvasHost() {
  if (!canvasHost) return;
  canvasHost.innerHTML = "";
}

function destroyMap() {
  clearMarkers();
  if (scsInsetMap) {
    scsInsetMap.remove();
    scsInsetMap = null;
  }
  if (scsInsetHost) scsInsetHost.innerHTML = "";
  if (map) {
    map.remove();
    map = null;
  }
  purgeCanvasHost();
}

function initScsInset() {
  if (!scsInsetHost || scsInsetMap) return Promise.resolve();
  scsInsetHost.innerHTML = "";
  return initScsInsetMap(scsInsetHost)
    .then(function (inset) {
      scsInsetMap = inset;
      onResize();
      return inset;
    })
    .catch(function (err) {
      console.warn("[诗词山河] 南海附图加载失败:", err);
      return null;
    });
}

function initMap() {
  if (!canvasHost) return Promise.reject(new Error("canvas host missing"));
  if (map) {
    map.resize();
    if (scsInsetMap) scsInsetMap.resize();
    return Promise.resolve(map);
  }
  purgeCanvasHost();
  return initPoetryChinaMap(canvasHost).then(function (m) {
    map = m;
    map.on("dragstart", function () {
      if (layer) layer.classList.add("is-orbit-dragging");
    });
    map.on("dragend", function () {
      if (layer) layer.classList.remove("is-orbit-dragging");
    });
    return m;
  });
}

function onResize() {
  if (map) map.resize();
  if (scsInsetMap) scsInsetMap.resize();
}

function afterMapVisible(cb) {
  requestAnimationFrame(function () {
    onResize();
    requestAnimationFrame(cb);
  });
}

function resetView(animated) {
  if (!map) return;
  flyToDefaultView(map, animated !== false);
}

function setControlsEnabled(on) {
  if (map) setMapInteraction(map, on);
}

function splitPoemLines(text) {
  var t = String(text || "").trim();
  if (!t) return [];
  var lines = [];
  t.split(/\n+/).forEach(function (chunk) {
    chunk
      .replace(/([。！？；])/g, "$1\n")
      .split("\n")
      .forEach(function (part) {
        var s = part.trim();
        if (s) lines.push(s);
      });
  });
  return lines.length ? lines : [t];
}

function renderPoemBody(content) {
  if (!poemBody) return;
  var lines = splitPoemLines(content);
  if (!lines.length) {
    poemBody.innerHTML = '<p class="poetry-map-3d__poem-line">（暂无正文）</p>';
    return;
  }
  poemBody.innerHTML = lines
    .map(function (line) {
      return '<p class="poetry-map-3d__poem-line">' + escapeHtml(line) + "</p>";
    })
    .join("");
}

function openPoemStage(poem, buildingName, province) {
  if (!layer || !poemStage) return;
  if (poemTitle) poemTitle.textContent = poem.title || "";
  if (poemMeta) {
    poemMeta.textContent = "〔" + (poem.dynasty || "") + "〕" + (poem.author || "");
  }
  renderPoemBody(poem.content);
  if (poemTag) {
    var tag = buildingName + " · " + province;
    if (poem.relation) tag += " · " + poem.relation;
    poemTag.textContent = tag;
  }
  if (buildingLink) {
    buildingLink.href = getBuildingDetailUrl(buildingName);
    buildingLink.textContent = "查看「" + buildingName.replace(/^北京/, "") + "」详情";
  }
  isPoemOpen = true;
  setControlsEnabled(false);
  layer.classList.add("is-poem-open");
  poemStage.setAttribute("aria-hidden", "false");
}

function closePoemStage() {
  if (!layer || !poemStage) return;
  isPoemOpen = false;
  setControlsEnabled(isOpen);
  layer.classList.remove("is-poem-open");
  poemStage.setAttribute("aria-hidden", "true");
}

function getBuildingEntry(buildingName) {
  if (!projectData || !projectData.buildings) return null;
  return projectData.buildings.find(function (b) {
    return b.name === buildingName;
  });
}

function isPoemStrictForBuilding(poemId, buildingName) {
  var b = getBuildingEntry(buildingName);
  if (!b) return false;
  var preview = (b.poems_preview || []).find(function (p) {
    return p.id === poemId;
  });
  if (preview) return preview.match_tier === "strict";
  if (b.poem_ids && b.poem_ids.indexOf(poemId) >= 0) return true;
  return false;
}

function isPoemAllowedForBuilding(poemId, buildingName) {
  if (!isPoemStrictForBuilding(poemId, buildingName)) return false;
  var b = getBuildingEntry(buildingName);
  if (!b) return false;
  if (b.poem_ids && b.poem_ids.length) {
    return b.poem_ids.indexOf(poemId) >= 0;
  }
  return (b.poems_preview || []).some(function (p) {
    return p.id === poemId;
  });
}

function isForbiddenTitle(title) {
  var t = String(title || "").replace(/·.*$/, "").trim();
  return !!FORBIDDEN_CIPAI[t];
}

function findPreviewPoem(poemId) {
  if (!projectData || !projectData.buildings) return null;
  var found = null;
  projectData.buildings.some(function (b) {
    return (b.poems_preview || []).some(function (p) {
      if (p.id === poemId) {
        found = p;
        return true;
      }
      return false;
    });
  });
  return found;
}

function openBuildingEmpty(buildingName, province) {
  openPoemStage(
    {
      title: buildingName,
      author: "",
      dynasty: "",
      content:
        "暂无与该建筑严格核实的关联诗词。\n\n" +
        "本页仅收录专咏或正文明确提及该建筑的篇目；" +
        "不使用词牌名（如《鹊桥仙》《隔帘听》等）或泛词误匹配。",
      relation: "待补充经核实的文献"
    },
    buildingName,
    province
  );
}

function showDetail(poemId, buildingName, province) {
  if (!isPoemAllowedForBuilding(poemId, buildingName)) {
    openBuildingEmpty(buildingName, province);
    return;
  }
  fetch("/api/poems/" + poemId, { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (poem) {
      if (!poem || isForbiddenTitle(poem.title)) {
        openBuildingEmpty(buildingName, province);
        return;
      }
      if (!poem.content) {
        var preview = findPreviewPoem(poemId);
        if (preview && preview.content) poem.content = preview.content;
      }
      openPoemStage(poem, buildingName, province);
    })
    .catch(function () {
      fetch(
        "/api/buildings/" + encodeURIComponent(buildingName) + "/poems?size=50",
        { cache: "no-store" }
      )
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (data) {
          var poem = (data.items || []).find(function (p) {
            return p.id === poemId;
          });
          if (!poem) throw new Error("poem missing");
          if (isForbiddenTitle(poem.title)) {
            openBuildingEmpty(buildingName, province);
            return;
          }
          openPoemStage(poem, buildingName, province);
        })
        .catch(function () {
          var preview = findPreviewPoem(poemId);
          if (preview && isForbiddenTitle(preview.title)) {
            openBuildingEmpty(buildingName, province);
            return;
          }
          if (preview && preview.content) {
            openPoemStage(preview, buildingName, province);
            return;
          }
          if (preview) {
            openPoemStage(
              {
                title: preview.title,
                author: preview.author,
                dynasty: preview.dynasty,
                content:
                  "未能加载完整正文。\n请确认已运行 node server.mjs 后刷新页面重试。"
              },
              buildingName,
              province
            );
            return;
          }
          openBuildingEmpty(buildingName, province);
        });
    });
}

function open() {
  if (!layer) {
    if (document.body.classList.contains("poetry-explore-page")) {
      notifyExplorePage("poetry-map-error", "页面组件未就绪，请刷新重试");
    } else {
      alert("诗词层未加载，请 Ctrl+Shift+R 强制刷新");
    }
    return;
  }
  showLayerShell();

  function runOpen() {
    var dataPromise = projectData ? Promise.resolve(projectData) : loadData();
    var mapPromise = map ? Promise.resolve(map) : initMap();

    Promise.all([dataPromise, mapPromise])
      .then(function (results) {
        if (!isOpen) return;
        map = results[1];
        return yieldFrame();
      })
      .then(function () {
        if (!isOpen) return;
        return new Promise(function (resolve) {
          afterMapVisible(resolve);
        });
      })
      .then(function () {
        if (!isOpen) return;
        finishOpen();
      })
      .catch(function (err) {
        console.error(err);
        setLoading(false);
        if (document.body.classList.contains("poetry-explore-page")) {
          notifyExplorePage(
            "poetry-map-error",
            "三维地图加载失败，请检查网络后刷新页面"
          );
          return;
        }
        alert("三维卫星地图加载失败，请检查网络后 Ctrl+Shift+R 刷新");
      });
  }

  if (document.body.classList.contains("poetry-explore-page")) {
    yieldFrame().then(runOpen);
  } else {
    runOpen();
  }
}

function close() {
  isOpen = false;
  closePoemStage();
  setControlsEnabled(false);
  hideLayerShell();
}

function toggle(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  if (isOpen) close();
  else open();
}

function bindUi() {
  layer = document.getElementById("poetryMap3dLayer");
  canvasHost = document.getElementById("poetryMap3dCanvasHost");
  scsInsetWrap = document.getElementById("poetryMapScsInset");
  scsInsetHost = document.getElementById("poetryMapScsInsetHost");
  hudSub = document.getElementById("poetryMap3dSub");
  poemStage = document.getElementById("poetryMap3dPoemStage");
  poemBack = document.getElementById("poetryMap3dPoemBack");
  poemTitle = document.getElementById("poetryMap3dPoemTitle");
  poemMeta = document.getElementById("poetryMap3dPoemMeta");
  poemBody = document.getElementById("poetryMap3dPoemBody");
  poemTag = document.getElementById("poetryMap3dPoemTag");
  buildingLink = document.getElementById("poetryMap3dBuildingLink");
  toggleBtn = document.getElementById("openPoetryLandscapeBtn");
  closeBtn = document.getElementById("poetryMap3dClose");
  resetBtn = document.getElementById("poetryMap3dReset");
  navPoetry = document.getElementById("indexNavPoetryMap");

  window.addEventListener("resize", onResize);

  if (toggleBtn) {
    toggleBtn.addEventListener("click", toggle);
    toggleBtn.addEventListener("mouseenter", warmupAssets, { once: true });
  }
  if (closeBtn) {
    closeBtn.addEventListener("click", function (e) {
      if (document.body.classList.contains("poetry-explore-page")) return;
      e.preventDefault();
      close();
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", function (e) {
      e.preventDefault();
      if (isPoemOpen) closePoemStage();
      else resetView(true);
    });
  }
  if (poemBack) {
    poemBack.addEventListener("click", function (e) {
      e.preventDefault();
      closePoemStage();
    });
  }
  if (navPoetry) {
    navPoetry.addEventListener("mouseenter", warmupAssets, { once: true });
    navPoetry.addEventListener("click", function (e) {
      e.preventDefault();
      open();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !isOpen) return;
    if (isPoemOpen) {
      e.preventDefault();
      closePoemStage();
      return;
    }
    close();
  });

  if (location.hash === "#poetry-map") {
    setTimeout(open, 500);
  }

  scheduleIdle(warmupAssets, 2500);

  if (layer) {
    layer.addEventListener("contextmenu", function (e) {
      if (isOpen) e.preventDefault();
    });
    layer.addEventListener("selectstart", function (e) {
      if (isOpen) e.preventDefault();
    });
  }
}

window.PoetryMap3d = {
  open: open,
  close: close,
  toggle: toggle,
  resetView: resetView,
  getRotation: function () {
    if (!map) return { rotX: 0, rotY: 0, zoom: 1 };
    return {
      rotX: map.getPitch(),
      rotY: map.getBearing(),
      zoom: map.getZoom()
    };
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindUi);
} else {
  bindUi();
}
