/**

 * 首页中国地图：按 PNG 实际不透明内容区域裁剪显示（含南海十段线附图）。

 * 2788×1536 画布两侧有透明留白，按不透明内容区域裁剪显示。

 */

(function () {

  var MAP_W = 2788;

  var MAP_H = 1536;

  /** 由 assets/index-map-china.png alpha 通道实测 */

  var CONTENT = { x: 518, y: 149, w: 2269, h: 1366 };

  /** 南海十字线岛礁附图外框（底图像素坐标，仅下方岛礁区域） */

  var NANHAI_LOWER = { x: 2286, y: 790, w: 525, h: 790 };

  var CONTENT_ASPECT = CONTENT.w / CONTENT.h;

  var layoutFn = null;



  function syncAppHeight() {

    var app = document.getElementById("app");

    if (app) app.style.height = window.innerHeight + "px";

  }



  function apply() {

    var media = document.getElementById("mapChinaMapMedia");

    var img = document.getElementById("mapChinaMap");

    var layer = document.querySelector(".map-china-layer");

    if (!media || !img) return;



    syncAppHeight();



    var padX = 28;

    var padBottom = 88;

    var nav = document.querySelector(".site-nav");

    var navH = nav ? nav.offsetHeight : 72;

    var availW = Math.max(320, window.innerWidth - padX * 2);

    var availH = Math.max(260, window.innerHeight - navH - padBottom);



    var w = Math.min(availW, availH * CONTENT_ASPECT);

    var h = w / CONTENT_ASPECT;

    var scale = w / CONTENT.w;

    var imgW = MAP_W * scale;

    var imgH = MAP_H * scale;

    var offsetX = -CONTENT.x * scale;

    var offsetY = -CONTENT.y * scale;



    if (layer) {

      layer.style.alignItems = "flex-end";

      layer.style.justifyContent = "center";

      layer.style.paddingBottom = padBottom + "px";

    }



    media.style.width = w + "px";

    media.style.height = h + "px";

    media.style.maxWidth = availW + "px";

    media.style.flex = "0 0 auto";

    media.style.position = "relative";

    media.style.overflow = "hidden";



    img.style.position = "absolute";

    img.style.left = offsetX + "px";

    img.style.top = offsetY + "px";

    img.style.width = imgW + "px";

    img.style.height = imgH + "px";

    img.style.maxWidth = "none";

    img.style.objectFit = "fill";

    img.style.objectPosition = "left top";

    img.style.display = "block";



    var frame = document.getElementById("mapChinaNanhaiFrameLower");

    if (frame) {

      var framePad = 2;

      var box = NANHAI_LOWER;

      frame.style.left = (box.x - CONTENT.x - framePad) * scale + "px";

      frame.style.top = (box.y - CONTENT.y - framePad) * scale + "px";

      frame.style.width = (box.w + framePad * 2) * scale + "px";

      frame.style.height = (box.h + framePad * 2) * scale + "px";

    }



    var relayout = layoutFn || window.__chinaMapHotspotLayout;

    if (typeof relayout === "function") relayout();

  }



  window.__fitChinaMapFull = apply;

  window.__registerChinaMapHotspotLayout = function (fn) {

    layoutFn = fn;

    apply();

  };



  function boot() {

    apply();

    var img = document.getElementById("mapChinaMap");

    if (img && !img.complete) {

      img.addEventListener("load", apply, { once: true });

      img.addEventListener("error", apply, { once: true });

    }

    [0, 80, 300, 800].forEach(function (ms) {

      window.setTimeout(apply, ms);

    });

  }



  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", boot);

  } else {

    boot();

  }

  window.addEventListener("resize", apply);

  window.addEventListener("load", apply);

})();


