/**
 * 真实感中国地形 · IDW 海拔插值
 * 数据来源：splendid-china-3d / elevation-points.js
 * https://github.com/leeshinyu2023/splendid-china-3d
 *
 * 不含 FBM 噪声，避免尖刺；仅大尺度海拔控制点插值 + 归一化。
 */
import { elevationPoints } from "./elevation-points.js";

var GEO = {
  latMin: 17,
  latMax: 55,
  lonMin: 72,
  lonMax: 136,
  u0: 0.1,
  v0: 0.07,
  u1: 0.9,
  v1: 0.9
};

export function setGeoUvBounds(u0, v0, u1, v1) {
  GEO.u0 = u0;
  GEO.v0 = v0;
  GEO.u1 = u1;
  GEO.v1 = v1;
}

export function uvToLatLon(u, v) {
  var spanU = GEO.u1 - GEO.u0;
  var spanV = GEO.v1 - GEO.v0;
  var lon = GEO.lonMin + ((u - GEO.u0) / spanU) * (GEO.lonMax - GEO.lonMin);
  var lat = GEO.latMax - ((v - GEO.v0) / spanV) * (GEO.latMax - GEO.latMin);
  return { lat: lat, lon: lon };
}

function idwElevationLatLon(lat, lon, points, power) {
  power = power || 2.2;
  var sumW = 0;
  var sumWV = 0;
  var maxDistSq = 14 * 14;
  var i;
  for (i = 0; i < points.length; i++) {
    var p = points[i];
    var dlat = lat - p[0];
    var dlon = lon - p[1];
    var distSq = dlat * dlat + dlon * dlon;
    if (distSq < 0.00002) return p[2];
    if (distSq > maxDistSq) continue;
    var dist = Math.sqrt(distSq);
    var w = 1 / Math.pow(dist, power);
    sumW += w;
    sumWV += w * p[2];
  }
  return sumW > 0 ? sumWV / sumW : 0;
}

/** 米 → 0~1，与 splendid-china-3d 的 elevationToY 同型曲线（无噪声） */
export function metersToElevNorm(elevMeters) {
  var m = Math.max(-154, Math.min(8848, elevMeters));
  var sign = m >= 0 ? 1 : -1;
  var shaped = sign * Math.pow(Math.abs(m), 0.52);
  var lo = Math.pow(154, 0.52);
  var hi = Math.pow(8848, 0.52);
  return Math.max(0.04, Math.min(0.96, (shaped + lo) / (hi + lo)));
}

export function elevationAtUv(u, v) {
  var ll = uvToLatLon(u, v);
  var meters = idwElevationLatLon(ll.lat, ll.lon, elevationPoints);
  return metersToElevNorm(meters);
}

export function elevationMetersAtUv(u, v) {
  var ll = uvToLatLon(u, v);
  return idwElevationLatLon(ll.lat, ll.lon, elevationPoints);
}
