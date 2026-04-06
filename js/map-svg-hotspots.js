/**
 * 地图底图 + 透明 SVG 热区：对齐显示区域、悬停信息卡、可选点击跳转。
 * opts: { root, img, anchor, svg, cardClass? } — svg 为已含 viewBox 的 <svg>，置于 anchor 内。
 */
(function () {
  const CARD_ID = "mapHotspotGlobalCard";

  var CARD_INNER_HTML =
    '<div class="map-hotspot-info-card__inner">' +
    '<div class="map-hotspot-info-card__brand" aria-hidden="true">太和殿</div>' +
    '<div class="map-hotspot-info-card__main">' +
    '<span class="map-hotspot-info-card__tag" data-card="tag"></span>' +
    '<h3 class="map-hotspot-info-card__title" data-card="title"></h3>' +
    '<p class="map-hotspot-info-card__en" data-card="en"></p>' +
    '<p class="map-hotspot-info-card__desc" data-card="desc"></p>' +
    "</div>" +
    "</div>";

  function ensureCard(extraClass) {
    var base = "map-hotspot-info-card";
    var fullClass = extraClass ? base + " " + String(extraClass).trim() : base;
    var el = document.getElementById(CARD_ID);
    if (el) {
      el.className = fullClass;
      if (!el.querySelector(".map-hotspot-info-card__inner")) {
        el.innerHTML = CARD_INNER_HTML;
      }
      return el;
    }
    el = document.createElement("div");
    el.id = CARD_ID;
    el.className = fullClass;
    el.setAttribute("role", "tooltip");
    el.innerHTML = CARD_INNER_HTML;
    document.body.appendChild(el);
    return el;
  }

  function parseObjectPosition(value) {
    var parts = (value || "").trim().split(/\s+/);
    var x = 0.5;
    var y = 0.5;
    function axis(p, vertical) {
      if (!p) return null;
      if (p === "left" || p === "right") return vertical ? null : p === "left" ? 0 : 1;
      if (p === "top" || p === "bottom") return vertical ? (p === "top" ? 0 : 1) : null;
      if (p === "center") return 0.5;
      if (/^-?[\d.]+%$/.test(p)) return parseFloat(p) / 100;
      return null;
    }
    if (parts.length === 1) {
      var ax = axis(parts[0], false);
      var ay = axis(parts[0], true);
      if (ax !== null) x = ax;
      if (ay !== null) y = ay;
      if (ax === null && ay === null) {
        var ay2 = axis(parts[0], true);
        if (ay2 !== null) y = ay2;
      }
    } else {
      var a0 = axis(parts[0], false);
      var a1 = axis(parts[1], true);
      if (a0 !== null) x = a0;
      if (a1 !== null) y = a1;
      if (a0 === null && axis(parts[0], true) !== null) y = axis(parts[0], true);
      if (a1 === null && axis(parts[1], false) !== null) x = axis(parts[1], false);
    }
    return { x: x, y: y };
  }

  /** 与热区 SVG viewBox 一致的内禀宽高；natural 为 0（未解码或 404）时用 viewBox 兜底，否则锚点永远 0×0、无法悬停。 */
  function getIntrinsicImageSize(img, svg) {
    var w = img.naturalWidth;
    var h = img.naturalHeight;
    if (w > 0 && h > 0) return { w: w, h: h };
    var vb = svg && svg.viewBox && svg.viewBox.baseVal;
    if (vb && vb.width > 0 && vb.height > 0) return { w: vb.width, h: vb.height };
    return null;
  }

  function syncAnchor(img, anchor, root, svg) {
    if (!img || !anchor || !root) return;
    var intr = getIntrinsicImageSize(img, svg);
    if (!intr) return;
    var ir = img.getBoundingClientRect();
    if (ir.width < 1 || ir.height < 1) return;
    var rr = root.getBoundingClientRect();
    var sl = root.scrollLeft || 0;
    var st = root.scrollTop || 0;
    var fit = getComputedStyle(img).objectFit || "fill";
    var iw = intr.w;
    var ih = intr.h;
    if (fit === "cover") {
      var cw = img.clientWidth;
      var ch = img.clientHeight;
      var pos = parseObjectPosition(getComputedStyle(img).objectPosition);
      var scale = Math.max(cw / iw, ch / ih);
      var dw = iw * scale;
      var dh = ih * scale;
      var offX = pos.x * (cw - dw);
      var offY = pos.y * (ch - dh);
      anchor.style.left = ir.left - rr.left + sl + offX + "px";
      anchor.style.top = ir.top - rr.top + st + offY + "px";
      anchor.style.width = dw + "px";
      anchor.style.height = dh + "px";
      return;
    }
    if (fit === "contain") {
      var cw2 = img.clientWidth;
      var ch2 = img.clientHeight;
      var pos2 = parseObjectPosition(getComputedStyle(img).objectPosition);
      var scale2 = Math.min(cw2 / iw, ch2 / ih);
      var dw2 = iw * scale2;
      var dh2 = ih * scale2;
      var offX2 = pos2.x * (cw2 - dw2);
      var offY2 = pos2.y * (ch2 - dh2);
      anchor.style.left = ir.left - rr.left + sl + offX2 + "px";
      anchor.style.top = ir.top - rr.top + st + offY2 + "px";
      anchor.style.width = dw2 + "px";
      anchor.style.height = dh2 + "px";
      return;
    }
    anchor.style.left = ir.left - rr.left + sl + "px";
    anchor.style.top = ir.top - rr.top + st + "px";
    anchor.style.width = ir.width + "px";
    anchor.style.height = ir.height + "px";
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function positionCard(card, clientX, clientY, placement) {
    var pad = 16;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    card.style.width = "";
    card.style.left = "";
    card.style.right = "";
    card.style.transform = "";
    var w = card.offsetWidth || 280;
    var h = card.offsetHeight || 120;
    /* 太和殿：画面上方居中（顶栏下），不占满屏宽 */
    if (placement === "top-center") {
      /* 太和殿：略抬高；水平略偏左（中心约在 43%） */
      var topBelowNav =
        card.classList.contains("map-hotspot-info-card--taihe") ? 52 : 72;
      card.style.left = card.classList.contains("map-hotspot-info-card--taihe")
        ? "38%"
        : "50%";
      card.style.top = Math.max(pad, topBelowNav) + "px";
      card.style.transform = "translateX(-50%)";
      if (card.classList.contains("map-hotspot-info-card--taihe")) {
        card.style.width = "min(520px, calc(100vw - " + pad * 2 + "px))";
      }
      return;
    }
    /* 右上角（备用） */
    if (placement === "top-right") {
      var topBelowNavR = 72;
      card.style.left = "auto";
      card.style.right = pad + "px";
      card.style.top = Math.max(pad, topBelowNavR) + "px";
      if (card.classList.contains("map-hotspot-info-card--taihe")) {
        card.style.width = "min(520px, calc(100vw - " + pad * 2 + "px))";
      }
      return;
    }
    /* 兼容旧 top */
    if (placement === "top") {
      var topBelowNav2 = 72;
      card.style.left = pad + "px";
      card.style.top = Math.max(pad, topBelowNav2) + "px";
      if (card.classList.contains("map-hotspot-info-card--taihe")) {
        card.style.width = "min(520px, calc(100vw - " + pad * 2 + "px))";
      }
      return;
    }
    if (placement === "right") {
      var rx = vw - w - pad;
      var ry = clientY - h / 2;
      ry = clamp(ry, pad, vh - h - pad);
      card.style.left = rx + "px";
      card.style.top = ry + "px";
      return;
    }
    var x = clientX + 14;
    var y = clientY + 14;
    if (x + w + pad > vw) x = clientX - w - 14;
    if (y + h + pad > vh) y = clientY - h - 14;
    x = clamp(x, pad, vw - w - pad);
    y = clamp(y, pad, vh - h - pad);
    card.style.left = x + "px";
    card.style.top = y + "px";
  }

  function readData(path) {
    return {
      zh: path.getAttribute("data-name-zh") || "",
      en: path.getAttribute("data-name-en") || "",
      category: path.getAttribute("data-category") || "",
      desc: path.getAttribute("data-desc") || "",
      placement: path.getAttribute("data-card-placement") || "",
    };
  }

  function showCard(card, path, clientX, clientY) {
    var d = readData(path);
    var tagEl = card.querySelector("[data-card=tag]");
    tagEl.textContent = d.category || "";
    tagEl.style.display = d.category ? "" : "none";
    card.querySelector("[data-card=title]").textContent = d.zh;
    var enEl = card.querySelector("[data-card=en]");
    enEl.textContent = d.en;
    enEl.style.display = d.en ? "" : "none";
    card.querySelector("[data-card=desc]").textContent = d.desc;
    card.classList.remove("is-visible");
    void card.offsetWidth;
    card.classList.add("is-visible");
    positionCard(card, clientX, clientY, d.placement);
  }

  window.initMapSvgHotspots = function initMapSvgHotspots(opts) {
    var root = opts.root;
    var img = opts.img;
    var anchor = opts.anchor;
    var svg = opts.svg;
    if (!root || !img || !anchor || !svg) return;

    if (svg.parentNode !== anchor) anchor.appendChild(svg);

    var card = ensureCard(opts.cardClass || "");
    var hideTimer = null;

    function layout() {
      syncAnchor(img, anchor, root, svg);
    }

    function layoutSoon() {
      layout();
      requestAnimationFrame(function () {
        layout();
        requestAnimationFrame(layout);
      });
    }

    if (opts.forceReinit) {
      delete svg.dataset.mhsInit;
    }
    if (svg.dataset.mhsInit === "1") {
      ensureCard(opts.cardClass || "");
      layoutSoon();
      return { layout: layout, destroy: function () {} };
    }
    svg.dataset.mhsInit = "1";

    function hideCard() {
      card.classList.remove("is-visible");
    }

    function bindPath(path) {
      path.addEventListener("mouseenter", function (e) {
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        showCard(card, path, e.clientX, e.clientY);
      });
      path.addEventListener("mousemove", function (e) {
        positionCard(card, e.clientX, e.clientY, readData(path).placement);
      });
      path.addEventListener("mouseleave", function () {
        hideTimer = setTimeout(hideCard, 100);
      });
      path.addEventListener("click", function (e) {
        var href = path.getAttribute("data-href");
        if (href) {
          e.preventDefault();
          window.location.href = href;
        }
      });
    }

    svg.querySelectorAll(".map-hotspot-path").forEach(bindPath);

    if (img.complete && (img.naturalWidth || getIntrinsicImageSize(img, svg))) layoutSoon();
    else {
      img.addEventListener("load", layoutSoon, { once: true });
      img.addEventListener(
        "error",
        function () {
          layoutSoon();
        },
        { once: true }
      );
    }

    /* 父层刚去掉 [hidden] 的同一帧内，getBoundingClientRect 仍可能为 0，锚点会一直是 0×0；延迟与监听 img 尺寸可消除 */
    function scheduleLayoutRetries() {
      [0, 32, 120, 400, 800].forEach(function (ms) {
        window.setTimeout(layoutSoon, ms);
      });
    }
    scheduleLayoutRetries();
    window.addEventListener("load", layoutSoon, { once: true });

    window.addEventListener("resize", layout);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(layout);
      ro.observe(root);
      ro.observe(img);
      if (img.parentElement) ro.observe(img.parentElement);
    }

    return { layout: layout, destroy: function () {} };
  };

  /**
   * 御花园等：在 map-svg-overlay-anchor 内用可见 DIV 线框做热区（百分比相对锚点），与 initMapSvgHotspots 同锚点叠放。
   * 须在 initMapSvgHotspots 之后调用，以便锚点已参与 layout。opts: { frameRoot, cardClass? }
   */
  window.bindMapHotspotFrameDivs = function bindMapHotspotFrameDivs(opts) {
    var root = opts.frameRoot;
    if (!root || root.dataset.mhsFrameBound === "1") return;
    root.dataset.mhsFrameBound = "1";
    var card = ensureCard(opts.cardClass || "");
    var hideTimer = null;
    function hideCard() {
      card.classList.remove("is-visible");
    }
    root.querySelectorAll(".yuhua-hotspot-frame").forEach(function (el) {
      el.addEventListener("mouseenter", function (e) {
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        showCard(card, el, e.clientX, e.clientY);
      });
      el.addEventListener("mousemove", function (e) {
        positionCard(card, e.clientX, e.clientY, readData(el).placement);
      });
      el.addEventListener("mouseleave", function () {
        hideTimer = setTimeout(hideCard, 100);
      });
    });
  };
})();
