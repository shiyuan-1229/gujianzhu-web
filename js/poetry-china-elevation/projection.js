/** 源自 splendid-china-3d / utils/projection.js */
export var LAT_MIN = 17;
export var LAT_MAX = 55;
export var LON_MIN = 72;
export var LON_MAX = 136;
export var SCENE_W = 80;
export var SCENE_H = 56;

export function latLonToScene(lat, lon) {
  var x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * SCENE_W - SCENE_W / 2;
  var z = -((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * SCENE_H + SCENE_H / 2;
  return { x: x, z: z };
}

export function sceneToLatLon(x, z) {
  var lon = ((x + SCENE_W / 2) / SCENE_W) * (LON_MAX - LON_MIN) + LON_MIN;
  var lat = -((z - SCENE_H / 2) / SCENE_H) * (LAT_MAX - LAT_MIN) + LAT_MIN;
  return { lat: lat, lon: lon };
}

/** 诗词山河视口：放大垂直起伏，使山地可见（原仓库 0.025 在缩小场景中几乎看不见） */
export var ELEV_Y_FACTOR = 0.2;

/** 非线性海拔 → 模型 Y */
export function elevationToY(elevMeters) {
  var m = Math.max(0, elevMeters);
  return Math.pow(m, 0.55) * ELEV_Y_FACTOR;
}
