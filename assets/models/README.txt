把下载好的古建筑 3D 模型放进这个文件夹（assets/models/）。

要求：
- 格式：.glb（推荐）或 .gltf。GLB 是单文件，最省事。
- 命名：默认欢迎页会按下面这些文件名查找，下载后重命名成对应名字即可；
  或者打开 welcome.html，在顶部的 MODELS 数组里把 file 改成你的实际文件名。

默认查找的文件名（放几个就显示几个，缺的会用占位模型代替）：
  gugong.glb     —— 故宫 / 太和殿（第一屏，作为开场主体）
  pagoda.glb     —— 宝塔
  pavilion.glb   —— 亭子
  archway.glb    —— 牌坊 / 牌楼
  tower.glb      —— 角楼 / 城楼

推荐下载来源（带授权、可下载）：
  - Sketchfab（搜 forbidden city / chinese pavilion / pagoda，筛选 Downloadable）
    https://sketchfab.com/3d-models/forbidden-city-model-5d300689fcae47ed980b38f680f59e02
  - 爱给网 古建筑 3D 模型
    https://www.aigei.com/s?q=%E5%8F%A4%E5%BB%BA%E7%AD%91&type=3d

注意：
- 若模型很大（>30MB）首屏会加载慢，建议先用中低面数版本。
- 若模型用了 Draco/Meshopt 压缩，本页已内置 Draco 解码；Meshopt 压缩的请在导出时关掉或转码。
- 模型会自动居中、自动缩放到合适大小，不需要你手动调比例。
