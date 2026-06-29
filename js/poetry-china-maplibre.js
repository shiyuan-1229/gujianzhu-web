/**
 * 诗词山河 · 仅中国版图 MapLibre 卫星 3D + 境外遮罩 + 南海附图
 */
import maplibregl from "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/+esm";
import { buildTransitionMaskLayers, addTransitionMaskLayers } from "./poetry-china-ocean-mask.js?v=58";

export { maplibregl };

export var CHINA_BOUNDS = [
  [73.0, 17.6],
  [135.8, 53.9]
];

/** 初始视野：中国 + 周边邻国，不铺整个亚洲 */
export var NEIGHBOR_VIEW_BOUNDS = [
  [68.5, 20.0],
  [132.0, 53.0]
];

/** 允许平移范围：略大于初始视野 */
export var PAN_BOUNDS = [
  [67.0, 18.0],
  [134.0, 54.2]
];

export var SCS_BOUNDS = [
  [105.0, 2.8],
  [123.5, 24.2]
];

export var DEFAULT_VIEW = {
  pitch: 58,
  bearing: 0
};

export var TERRAIN_EXAGGERATION = 6;

var CHINA_BORDER = "./assets/china-bound-100000.json";
var CHINA_PROVINCES_BORDER = "./assets/china-provinces-bound.json";
/** 域外远端：灰暖沙色；国界外 150km 内不盖沙色，保留邻境卫星 */
var REGION_OUTSIDE_COLOR = "#A89888";
var VIEW_PADDING = { top: 92, bottom: 56, left: 32, right: 228 };

var chinaGeoCache = null;
var chinaProvincesGeoCache = null;

function loadChinaProvincesGeo() {
  if (chinaProvincesGeoCache) return Promise.resolve(chinaProvincesGeoCache);
  return fetch(CHINA_PROVINCES_BORDER, { cache: "force-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("china provinces border missing");
      return r.json();
    })
    .then(function (geo) {
      chinaProvincesGeoCache = geo;
      return geo;
    });
}

function provinceLineFilter() {
  return ["==", ["get", "level"], "province"];
}

function addProvinceBordersToMap(map) {
  if (!map || !map.getContainer || !map.getContainer()) return Promise.resolve();
  if (map.getSource("china-provinces")) return Promise.resolve();

  return loadChinaProvincesGeo()
    .then(function (geo) {
      if (!map.getContainer()) return;
      if (map.getSource("china-provinces")) return;

      map.addSource("china-provinces", { type: "geojson", data: geo });

      var before = map.getLayer("china-border-glow") ? "china-border-glow" : undefined;

      map.addLayer(
        {
          id: "province-border-glow",
          type: "line",
          source: "china-provinces",
          filter: provinceLineFilter(),
          paint: {
            "line-color": "#E8CC6A",
            "line-width": ["interpolate", ["linear"], ["zoom"], 2, 1.6, 5, 2.6, 9, 3.8],
            "line-opacity": 0.12,
            "line-blur": 1.2
          }
        },
        before
      );

      map.addLayer(
        {
          id: "province-border-line",
          type: "line",
          source: "china-provinces",
          filter: provinceLineFilter(),
          paint: {
            "line-color": "#F0D878",
            "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.65, 5, 1, 9, 1.55],
            "line-opacity": 0.48
          }
        },
        before
      );
    })
    .catch(function (err) {
      console.warn("[诗词山河] 省界加载失败:", err);
    });
}

function loadChinaGeo() {
  if (chinaGeoCache) return Promise.resolve(chinaGeoCache);
  return fetch(CHINA_BORDER, { cache: "force-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("china border missing");
      return r.json();
    })
    .then(function (geo) {
      chinaGeoCache = geo;
      return geo;
    });
}

function satelliteSource() {
  return {
    type: "raster",
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    ],
    tileSize: 256,
    maxzoom: 18
  };
}

function demSource() {
  return {
    type: "raster-dem",
    tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
    encoding: "terrarium",
    tileSize: 256,
    maxzoom: 15
  };
}

export function createPoetryChinaMapStyle(withTerrain) {
  var style = {
    version: 8,
    name: "Poetry China Only",
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      satellite: satelliteSource(),
      "china-border": { type: "geojson", data: CHINA_BORDER }
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": REGION_OUTSIDE_COLOR }
      },
      {
        id: "satellite",
        type: "raster",
        source: "satellite",
        paint: {
          "raster-brightness-max": 0.98,
          "raster-brightness-min": 0.04,
          "raster-contrast": 0.05,
          "raster-saturation": 0.14
        }
      },
      {
        id: "china-border-glow",
        type: "line",
        source: "china-border",
        paint: {
          "line-color": "#FFC940",
          "line-width": ["interpolate", ["linear"], ["zoom"], 2, 5, 5, 8, 9, 12],
          "line-opacity": 0.42,
          "line-blur": 2.5
        }
      },
      {
        id: "china-border-line",
        type: "line",
        source: "china-border",
        paint: {
          "line-color": "#FFE566",
          "line-width": ["interpolate", ["linear"], ["zoom"], 2, 1.6, 5, 2.6, 9, 3.8],
          "line-opacity": 0.96
        }
      }
    ]
  };

  if (withTerrain) {
    style.sources["terrain-source"] = demSource();
    style.terrain = { source: "terrain-source", exaggeration: TERRAIN_EXAGGERATION };
  }

  return style;
}

/** 首屏不加 DEM，避免阻塞 map load */
export function createPoetryChinaFastStyle() {
  return createPoetryChinaMapStyle(false);
}

function scheduleIdle(fn, timeoutMs) {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(fn, { timeout: timeoutMs || 1800 });
  } else {
    setTimeout(fn, Math.min(timeoutMs || 1800, 600));
  }
}

function addTerrainToMap(map) {
  if (!map || !map.getContainer || !map.getContainer()) return;
  if (map.getSource("terrain-source")) {
    map.setTerrain({ source: "terrain-source", exaggeration: TERRAIN_EXAGGERATION });
    return;
  }
  map.addSource("terrain-source", demSource());
  map.setTerrain({ source: "terrain-source", exaggeration: TERRAIN_EXAGGERATION });
}

export function preloadChinaGeo() {
  return Promise.all([
    loadChinaGeo(),
    loadChinaProvincesGeo().catch(function () {})
  ]);
}

function enable360Rotation(map) {
  map.dragPan.enable();
  map.scrollZoom.enable();
  map.dragRotate.enable();
  map.touchZoomRotate.enable();
  if (map.touchPitch) map.touchPitch.enable();
  map.doubleClickZoom.enable();
  map.keyboard.enable();
  map.boxZoom.enable();
}

export function applyChinaView(map, animated) {
  var opts = {
    padding: VIEW_PADDING,
    pitch: DEFAULT_VIEW.pitch,
    bearing: DEFAULT_VIEW.bearing,
    maxZoom: 4.35
  };
  if (animated) {
    map.fitBounds(NEIGHBOR_VIEW_BOUNDS, Object.assign({ duration: 520, essential: true }, opts));
  } else {
    map.fitBounds(NEIGHBOR_VIEW_BOUNDS, Object.assign({ duration: 0 }, opts));
  }
  map.setMaxBounds(PAN_BOUNDS);
  map.setMinZoom(2.5);
}

function applyTransitionMaskAsync(map, chinaGeo) {
  scheduleIdle(function () {
    buildTransitionMaskLayers(chinaGeo)
      .then(function (layers) {
        if (!map || !map.getContainer || !map.getContainer()) return;
        addTransitionMaskLayers(map, layers, REGION_OUTSIDE_COLOR, "china-border-glow");
      })
      .catch(function (err) {
        console.warn("[诗词山河] 域外渐变加载失败，使用卫星原图:", err);
      });
  }, 4000);
}

function setupMapAfterLoad(map) {
  applyChinaView(map, false);
  addProvinceBordersToMap(map);
  scheduleIdle(function () {
    addTerrainToMap(map);
  }, 1200);
  loadChinaGeo().then(function (geo) {
    applyTransitionMaskAsync(map, geo);
  });
}

export function initPoetryChinaMap(container) {
  return new Promise(function (resolve, reject) {
    function createMap() {
      var map = new maplibregl.Map({
        container: container,
        style: createPoetryChinaFastStyle(),
        center: [104.5, 35.5],
        zoom: 3.2,
        pitch: DEFAULT_VIEW.pitch,
        bearing: DEFAULT_VIEW.bearing,
        maxPitch: 85,
        pitchWithRotate: true,
        bearingSnap: 0,
        antialias: false,
        maxZoom: 13,
        minZoom: 2.5,
        attributionControl: false,
        renderWorldCopies: false,
        fadeDuration: 0
      });

      map.addControl(
        new maplibregl.NavigationControl({ visualizePitch: true }),
        "bottom-left"
      );

      enable360Rotation(map);

      var settled = false;
      function finish(err) {
        if (settled) return;
        settled = true;
        if (err) {
          reject(err);
          return;
        }
        try {
          setupMapAfterLoad(map);
          requestAnimationFrame(function () {
            map.resize();
            resolve(map);
          });
        } catch (e) {
          reject(e);
        }
      }

      map.once("load", function () {
        finish();
      });

      map.on("error", function (e) {
        if (e && e.error && e.error.message) {
          console.warn("[诗词山河 MapLibre]", e.error.message);
        }
      });

      setTimeout(function () {
        if (!settled && map.isStyleLoaded && map.isStyleLoaded()) {
          finish();
        } else if (!settled) {
          finish(new Error("map load timeout"));
        }
      }, 12000);
    }

    requestAnimationFrame(function () {
      setTimeout(createMap, 0);
    });
  });
}

function createScsInsetStyle() {
  return createPoetryChinaFastStyle();
}

function waitForContainerSize(container, tries) {
  return new Promise(function (resolve) {
    var left = tries || 20;
    function tick() {
      if (container.offsetWidth > 40 && container.offsetHeight > 40) {
        resolve();
        return;
      }
      left -= 1;
      if (left <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    }
    tick();
  });
}

export function initScsInsetMap(container) {
  return waitForContainerSize(container).then(function () {
    return new Promise(function (resolve, reject) {
      var map = new maplibregl.Map({
        container: container,
        style: createScsInsetStyle(),
        center: [114.5, 11.5],
        zoom: 4.1,
        pitch: 0,
        bearing: 0,
        interactive: false,
        attributionControl: false,
        renderWorldCopies: false,
        maxBounds: [
          [103.5, 1.8],
          [124.5, 25.8]
        ]
      });

      var settled = false;
      function finish() {
        map.fitBounds(SCS_BOUNDS, { padding: 5, duration: 0, maxZoom: 6.8 });
        addProvinceBordersToMap(map).finally(function () {
          requestAnimationFrame(function () {
            map.resize();
            resolve(map);
          });
        });
      }

      map.on("load", function () {
        if (settled) return;
        settled = true;
        finish();
      });

      map.on("error", function (e) {
        if (e && e.error && e.error.message) {
          console.warn("[南海附图]", e.error.message);
        }
      });

      setTimeout(function () {
        if (settled) return;
        if (map.loaded()) {
          settled = true;
          finish();
        } else {
          settled = true;
          reject(new Error("scs inset timeout"));
        }
      }, 20000);
    });
  });
}

export function flyToDefaultView(map, animated) {
  applyChinaView(map, animated !== false);
}

export function setMapInteraction(map, enabled) {
  if (!map) return;
  var fn = enabled ? "enable" : "disable";
  map.dragPan[fn]();
  map.dragRotate[fn]();
  map.scrollZoom[fn]();
  map.touchZoomRotate[fn]();
  if (map.touchPitch) map.touchPitch[fn]();
  map.doubleClickZoom[fn]();
  map.keyboard[fn]();
  if (map.boxZoom) map.boxZoom[fn]();
}
