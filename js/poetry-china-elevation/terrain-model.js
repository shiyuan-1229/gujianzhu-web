/**
 * 中国地形 3D 模型 · splendid-china-3d / terrain.js
 * 修复：可见起伏 + 去边缘尖刺 + 高度平滑
 */
import * as THREE from "three";
import { createNoise2D, fbm } from "./noise.js";
import { latLonToScene, elevationToY } from "./projection.js";
import { elevationPoints } from "./elevation-points.js";

var GEOJSON_LOCAL = "./assets/china-bound-100000.json";
var GEOJSON_REMOTE = "https://geo.datav.aliyun.com/areas_v3/bound/100000.json";
var noise = createNoise2D(42);

function idw(x, z, points, power) {
  power = power || 2.5;
  var sumW = 0;
  var sumWV = 0;
  var maxDist = 30;
  var i;
  for (i = 0; i < points.length; i++) {
    var pt = points[i];
    var p = latLonToScene(pt[0], pt[1]);
    var dx = x - p.x;
    var dz = z - p.z;
    var distSq = dx * dx + dz * dz;
    if (distSq < 0.0001) return pt[2];
    if (distSq > maxDist * maxDist) continue;
    var dist = Math.sqrt(distSq);
    var w = 1 / Math.pow(dist, power);
    sumW += w;
    sumWV += w * pt[2];
  }
  return sumW > 0 ? sumWV / sumW : 0;
}

function computeTerrainY(x, z) {
  var baseElev = idw(x, z, elevationPoints);
  /* 原仓库 perturbation 含 min(50) 会在低海拔/边缘制造尖刺，此处仅高山加轻微细节 */
  var y = elevationToY(baseElev);
  if (baseElev > 1200) {
    var noiseVal = fbm(noise, x * 0.1, z * 0.1, 3, 2.0, 0.5);
    y = elevationToY(baseElev + noiseVal * baseElev * 0.04);
  }
  return y;
}

function geoJsonToShapes(geoJson) {
  var shapes = [];
  var geometry = geoJson.features[0].geometry;
  var polygons =
    geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
  var pi;
  var ri;
  var hi;

  for (pi = 0; pi < polygons.length; pi++) {
    var polygon = polygons[pi];
    var outerRing = polygon[0];
    var shape = new THREE.Shape();
    for (ri = 0; ri < outerRing.length; ri++) {
      var lon = outerRing[ri][0];
      var lat = outerRing[ri][1];
      var p = latLonToScene(lat, lon);
      if (ri === 0) shape.moveTo(p.x, p.z);
      else shape.lineTo(p.x, p.z);
    }
    for (hi = 1; hi < polygon.length; hi++) {
      var holeRing = polygon[hi];
      var hole = new THREE.Path();
      for (ri = 0; ri < holeRing.length; ri++) {
        lon = holeRing[ri][0];
        lat = holeRing[ri][1];
        p = latLonToScene(lat, lon);
        if (ri === 0) hole.moveTo(p.x, p.z);
        else hole.lineTo(p.x, p.z);
      }
      shape.holes.push(hole);
    }
    shapes.push(shape);
  }
  return shapes;
}

function fetchGeoJson() {
  return fetch(GEOJSON_LOCAL, { cache: "force-cache" }).then(function (r) {
    if (r.ok) return r.json();
    return fetch(GEOJSON_REMOTE).then(function (r2) {
      if (!r2.ok) throw new Error("china geojson unavailable");
      return r2.json();
    });
  });
}

function addNeighbor(map, a, b) {
  if (a === b) return;
  if (map[a].indexOf(b) < 0) map[a].push(b);
}

function smoothMeshHeights(geometry, passes) {
  var pos = geometry.attributes.position;
  var index = geometry.index;
  if (!index) return;
  var count = pos.count;
  var neighbors = new Array(count);
  var i;
  var j;
  for (i = 0; i < count; i++) neighbors[i] = [];
  for (i = 0; i < index.count; i += 3) {
    var a = index.getX(i);
    var b = index.getX(i + 1);
    var c = index.getX(i + 2);
    addNeighbor(neighbors, a, b);
    addNeighbor(neighbors, a, c);
    addNeighbor(neighbors, b, a);
    addNeighbor(neighbors, b, c);
    addNeighbor(neighbors, c, a);
    addNeighbor(neighbors, c, b);
  }
  var buf = new Float32Array(count);
  var p;
  for (p = 0; p < passes; p++) {
    for (i = 0; i < count; i++) {
      var y0 = pos.getY(i);
      var sum = y0;
      var nlist = neighbors[i];
      for (j = 0; j < nlist.length; j++) sum += pos.getY(nlist[j]);
      buf[i] = sum / (nlist.length + 1);
    }
    for (i = 0; i < count; i++) pos.setY(i, buf[i]);
  }
  pos.needsUpdate = true;
}

export function getHeightRange(geometry) {
  var pos = geometry.attributes.position;
  var minY = Infinity;
  var maxY = -Infinity;
  var i;
  for (i = 0; i < pos.count; i++) {
    var y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { min: minY, max: maxY };
}

function displaceGeometry(geometry) {
  var positions = geometry.attributes.position.array;
  var vertexCount = positions.length / 3;
  var elevations = new Float32Array(vertexCount);
  var i;

  for (i = 0; i < vertexCount; i++) {
    var x = positions[i * 3];
    var z = positions[i * 3 + 2];
    var y = computeTerrainY(x, z);
    positions[i * 3 + 1] = y;
    elevations[i] = y;
  }

  smoothMeshHeights(geometry, 5);

  var range = getHeightRange(geometry);
  var floorY = Math.max(0, range.min * 0.15);
  for (i = 0; i < vertexCount; i++) {
    var yi = positions[i * 3 + 1];
    if (yi < floorY) {
      yi = floorY;
      positions[i * 3 + 1] = yi;
    }
    elevations[i] = yi;
  }

  geometry.computeVertexNormals();
  geometry.setAttribute("aElevation", new THREE.BufferAttribute(elevations, 1));
  return getHeightRange(geometry);
}

export async function createTerrainFromGeoJson(curveSegments) {
  curveSegments = curveSegments || 64;
  var geoJson = await fetchGeoJson();
  var shapes = geoJsonToShapes(geoJson);
  if (!shapes.length) throw new Error("empty china shapes");
  var geometry = new THREE.ShapeGeometry(shapes, curveSegments);
  geometry.rotateX(-Math.PI / 2);
  var range = displaceGeometry(geometry);
  return { geometry: geometry, maxElev: range.max, minElev: range.min };
}

export function getTerrainHeight(x, z) {
  return computeTerrainY(x, z);
}
