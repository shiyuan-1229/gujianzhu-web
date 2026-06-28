# splendid-china-3d 地形模块 · 如何回退

本目录移植自 [splendid-china-3d](https://github.com/leeshinyu2023/splendid-china-3d) 的中国 3D 地形模型。

## 当前集成方式

诗词山河**默认**使用别人仓库的完整 3D 模型：

- `terrain-model.js` — GeoJSON 国界 + IDW 海拔 + FBM 起伏（与原仓库 `terrain.js` 一致）
- `ink-terrain-material.js` — 青绿山水水墨 shader（与原仓库 `main.js` 一致）
- `elevation-points.js` / `noise.js` / `projection.js` — 配套数据与算法

古建诗签按经纬度（`POETRY_MAP_POSITIONS.lng/lat`）落在 3D 地形上。

## 回退到 PNG 浮岛

1. 打开 `js/poetry-map-3d.js`
2. 将 `loadIslandMesh` 改回只加载 `MAP_TEX` + `buildIsland(tex)`（删除 `buildSplendidChinaTerrain` 调用）
3. 删除 `poetry-china-elevation/` 下 splendid 相关 import
4. Ctrl+Shift+R 强制刷新

## 文件说明

| 文件 | 来源 | 作用 |
|------|------|------|
| `terrain-model.js` | splendid-china-3d/terrain.js | 3D 地形几何体 |
| `ink-terrain-material.js` | splendid-china-3d/main.js | 水墨材质 |
| `elevation-points.js` | splendid-china-3d | 海拔控制点 |
| `noise.js` | splendid-china-3d | FBM 噪声 |
| `projection.js` | splendid-china-3d | 经纬度投影 |
| `terrain-idw.js` | 自研（仅 PNG 回退用） | UV 海拔插值 |
| `terrain-geojson.js` | 旧版中间方案 | 可删除 |
| `assets/china-bound-100000.json` | 阿里云 DataV | 中国国界 |
