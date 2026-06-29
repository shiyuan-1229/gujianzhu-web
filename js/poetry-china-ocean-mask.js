/**
 * 域外渐变：国界内全彩 → 邻境卫星可见 → 逐步过渡到灰暖沙色
 */
var turfModule = null;
var transitionCache = null;

var RING_SPECS = [
  { fromKm: 120, toKm: 320, opacity: 0.14 },
  { fromKm: 320, toKm: 520, opacity: 0.32 },
  { fromKm: 520, toKm: 720, opacity: 0.52 },
  { fromKm: 720, toKm: 950, opacity: 0.72 }
];

var FAR_BUFFER_KM = 950;
var FAR_OPACITY = 0.88;

function loadTurf() {
  if (turfModule) return Promise.resolve(turfModule);
  return Promise.race([
    import("https://cdn.jsdelivr.net/npm/@turf/turf@7.2.0/+esm").then(function (m) {
      turfModule = m.default || m;
      return turfModule;
    }),
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error("turf load timeout"));
      }, 12000);
    })
  ]);
}

function worldPolygon(turf) {
  return turf.polygon([
    [
      [-180, -90],
      [180, -90],
      [180, 90],
      [-180, 90],
      [-180, -90]
    ]
  ]);
}

function makeRing(turf, chinaFeature, fromKm, toKm) {
  var outer = turf.buffer(chinaFeature, toKm, { units: "kilometers", steps: 8 });
  var inner =
    fromKm <= 0
      ? chinaFeature
      : turf.buffer(chinaFeature, fromKm, { units: "kilometers", steps: 8 });
  try {
    return turf.difference(outer, inner);
  } catch (e) {
    return null;
  }
}

function makeFarMask(turf, chinaFeature) {
  var world = worldPolygon(turf);
  var capped = turf.buffer(chinaFeature, FAR_BUFFER_KM, { units: "kilometers", steps: 8 });
  try {
    return turf.difference(world, capped);
  } catch (e) {
    return null;
  }
}

export function buildTransitionMaskLayers(chinaGeoJson) {
  if (transitionCache) return Promise.resolve(transitionCache);
  var chinaFeature = chinaGeoJson.features[0];
  return loadTurf().then(function (turf) {
    var layers = [];
    var i;
    for (i = 0; i < RING_SPECS.length; i++) {
      var spec = RING_SPECS[i];
      var ring = makeRing(turf, chinaFeature, spec.fromKm, spec.toKm);
      if (ring) {
        layers.push({
          id: "transition-ring-" + i,
          data: ring,
          opacity: spec.opacity
        });
      }
    }
    var far = makeFarMask(turf, chinaFeature);
    if (far) {
      layers.push({
        id: "transition-far",
        data: far,
        opacity: FAR_OPACITY
      });
    }
    transitionCache = layers;
    return layers;
  });
}

export function addTransitionMaskLayers(map, layers, sandColor, beforeLayerId) {
  var i;
  for (i = 0; i < layers.length; i++) {
    var layer = layers[i];
    var srcId = "transition-mask-src-" + i;
    var layerId = layer.id;
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(srcId)) map.removeSource(srcId);
    map.addSource(srcId, { type: "geojson", data: layer.data });
    map.addLayer(
      {
        id: layerId,
        type: "fill",
        source: srcId,
        paint: {
          "fill-color": sandColor,
          "fill-opacity": layer.opacity
        }
      },
      beforeLayerId || undefined
    );
  }
}

/** 南海附图：范围小，用两档轻渐变即可 */
export function buildScsTransitionLayers(chinaGeoJson) {
  return loadTurf().then(function (turf) {
    var chinaFeature = chinaGeoJson.features[0];
    var layers = [];
    var r1 = makeRing(turf, chinaFeature, 80, 220);
    if (r1) layers.push({ id: "scs-ring-0", data: r1, opacity: 0.2 });
    var r2 = makeRing(turf, chinaFeature, 220, 480);
    if (r2) layers.push({ id: "scs-ring-1", data: r2, opacity: 0.45 });
    var far = makeFarMask(turf, chinaFeature);
    if (far) layers.push({ id: "scs-far", data: far, opacity: 0.75 });
    return layers;
  });
}
