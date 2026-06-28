/**
 * 中国地形 3D 模型 · GeoJSON 国界 + IDW 海拔
 * 源自 splendid-china-3d createTerrainFromGeoJson 思路
 * https://github.com/leeshinyu2023/splendid-china-3d
 *
 * 不含 FBM 噪声，避免尖刺；贴图 UV 对齐诗词山河浮岛辅导图。
 */
import * as THREE from "three";
import { elevationAtUv, setGeoUvBounds } from "./terrain-idw.js";

var GEOJSON_LOCAL = "./assets/china-bound-100000.json";
var GEOJSON_REMOTE = "https://geo.datav.aliyun.com/areas_v3/bound/100000.json";

var LON_MIN = 72;
var LON_MAX = 136;
var LAT_MIN = 17;
var LAT_MAX = 55;

export function latLonToWorld(lat, lon, mapW, mapH, outlineUv) {
  var spanU = outlineUv.u1 - outlineUv.u0;
  var spanV = outlineUv.v1 - outlineUv.v0;
  var u = outlineUv.u0 + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * spanU;
  var v = outlineUv.v0 + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * spanV;
  return {
    x: (u - 0.5) * mapW,
    z: (v - 0.5) * mapH,
    u: u,
    v: v
  };
}

export function worldToUv(worldX, worldZ, mapW, mapH) {
  return {
    u: worldX / mapW + 0.5,
    v: worldZ / mapH + 0.5
  };
}

function geoJsonToShapes(geoJson, mapW, mapH, outlineUv) {
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
      var p = latLonToWorld(lat, lon, mapW, mapH, outlineUv);
      if (ri === 0) shape.moveTo(p.x, p.z);
      else shape.lineTo(p.x, p.z);
    }
    for (hi = 1; hi < polygon.length; hi++) {
      var holeRing = polygon[hi];
      var hole = new THREE.Path();
      for (ri = 0; ri < holeRing.length; ri++) {
        lon = holeRing[ri][0];
        lat = holeRing[ri][1];
        p = latLonToWorld(lat, lon, mapW, mapH, outlineUv);
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

function buildHeightSampler(mapW, mapH, terrainBaseY, terrainDisp) {
  return {
    heightAtWorld: function (worldX, worldZ) {
      var uv = worldToUv(worldX, worldZ, mapW, mapH);
      if (uv.u < 0 || uv.u > 1 || uv.v < 0 || uv.v > 1) return terrainBaseY;
      return terrainBaseY + elevationAtUv(uv.u, uv.v) * terrainDisp;
    },
    heightAtUv: function (u, v) {
      return terrainBaseY + elevationAtUv(u, v) * terrainDisp;
    }
  };
}

/**
 * 从国界 GeoJSON 生成带真实海拔起伏的中国地形 Mesh
 */
export async function createChinaTerrainMesh(texture, options) {
  var mapW = options.mapW;
  var mapH = options.mapH;
  var outlineUv = options.outlineUv;
  var terrainBaseY = options.terrainBaseY;
  var terrainDisp = options.terrainDisp;
  var curveSegments = options.curveSegments || 96;

  setGeoUvBounds(outlineUv.u0, outlineUv.v0, outlineUv.u1, outlineUv.v1);

  var geoJson = await fetchGeoJson();
  var shapes = geoJsonToShapes(geoJson, mapW, mapH, outlineUv);
  if (!shapes.length) throw new Error("empty china shapes");

  var geometry = new THREE.ShapeGeometry(shapes, curveSegments);
  geometry.rotateX(-Math.PI / 2);

  var positions = geometry.attributes.position;
  var vertexCount = positions.count;
  var uvAttr = new Float32Array(vertexCount * 2);
  var i;

  for (i = 0; i < vertexCount; i++) {
    var x = positions.getX(i);
    var z = positions.getZ(i);
    var uv = worldToUv(x, z, mapW, mapH);
    var elev = elevationAtUv(uv.u, uv.v);
    positions.setY(i, terrainBaseY + elev * terrainDisp);
    uvAttr[i * 2] = uv.u;
    uvAttr[i * 2 + 1] = uv.v;
  }

  geometry.setAttribute("uv", new THREE.BufferAttribute(uvAttr, 2));
  geometry.computeVertexNormals();

  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;

  var mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.9,
    metalness: 0.03,
    flatShading: false,
    side: THREE.FrontSide
  });

  var mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = true;

  return {
    mesh: mesh,
    heightSampler: buildHeightSampler(mapW, mapH, terrainBaseY, terrainDisp)
  };
}
