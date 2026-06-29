/**
 * splendid-china-3d 原始 terrain.js 参数（未修改）
 * 仅供 splendid-china-reference.html 对照预览
 */
import * as THREE from "three";
import { createNoise2D, fbm } from "./noise.js";
import { latLonToScene, elevationToY } from "./projection-original.js";
import { elevationPoints } from "./elevation-points.js";

var GEOJSON_LOCAL = "./assets/china-bound-100000.json";
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
  var noiseVal = fbm(noise, x * 0.15, z * 0.15, 5, 2.0, 0.5);
  var perturbation = noiseVal * Math.max(Math.abs(baseElev) * 0.15, 50);
  return elevationToY(baseElev + perturbation);
}

function geoJsonToShapes(geoJson) {
  var shapes = [];
  var geometry = geoJson.features[0].geometry;
  var polygons =
    geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
  var pi, ri, hi;
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

function getHeightRange(geometry) {
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

export async function createTerrainFromGeoJson(curveSegments) {
  curveSegments = curveSegments || 24;
  var r = await fetch(GEOJSON_LOCAL, { cache: "force-cache" });
  if (!r.ok) throw new Error("geojson missing");
  var geoJson = await r.json();
  var shapes = geoJsonToShapes(geoJson);
  var geometry = new THREE.ShapeGeometry(shapes, curveSegments);
  geometry.rotateX(-Math.PI / 2);
  var positions = geometry.attributes.position.array;
  var vertexCount = positions.length / 3;
  var i;
  for (i = 0; i < vertexCount; i++) {
    var x = positions[i * 3];
    var z = positions[i * 3 + 2];
    positions[i * 3 + 1] = computeTerrainY(x, z);
  }
  geometry.computeVertexNormals();
  return { geometry: geometry, maxElev: getHeightRange(geometry).max };
}
