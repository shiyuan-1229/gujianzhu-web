/** 原仓库 projection.js · 未修改参数（elevationToY 系数 0.025） */
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

export function elevationToY(elevMeters) {
  var sign = elevMeters >= 0 ? 1 : -1;
  return sign * Math.pow(Math.abs(elevMeters), 0.55) * 0.025;
}
