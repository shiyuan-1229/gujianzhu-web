(function () {
  "use strict";

  const API = "/api/poetry-landscape";
  const POEM_API = "/api/poems";

  let landscapeData = null;
  let activeTheme = "all";
  let activeProvince = "all";

  const root = document.getElementById("poetryLandscape");
  if (!root) return;

  const mapEl = document.getElementById("plMapInner");
  const subtitleEl = document.getElementById("plSubtitle");
  const themeFiltersEl = document.getElementById("plThemeFilters");
  const provinceTabsEl = document.getElementById("plProvinceTabs");
  const detailEl = document.getElementById("plDetail");
  const detailTitle = document.getElementById("plDetailTitle");
  const detailMeta = document.getElementById("plDetailMeta");
  const detailContent = document.getElementById("plDetailContent");
  const detailBuilding = document.getElementById("plDetailBuilding");

  function open() {
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (!landscapeData) {
      loadData();
    } else {
      renderMap();
    }
  }

  function close() {
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    hideDetail();
  }

  function applyData(data) {
    landscapeData = data;
    if (subtitleEl) subtitleEl.textContent = landscapeData.subtitle || "";
    renderThemeFilters();
    renderProvinceTabs();
    renderMap();
  }

  async function loadData() {
    if (subtitleEl) subtitleEl.textContent = "古建智寻 · 正在加载诗词…";
    if (mapEl) {
      mapEl.innerHTML =
        '<p style="color:rgba(255,255,255,.5);text-align:center;padding:2rem">加载诗词山河…</p>';
    }

    try {
      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = controller
        ? setTimeout(function () {
            controller.abort();
          }, 8000)
        : null;
      var resp = await fetch(API + "?scope=project", {
        cache: "no-store",
        signal: controller ? controller.signal : undefined,
      });
      if (timer) clearTimeout(timer);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      applyData(await resp.json());
      return;
    } catch (err) {
      console.warn("API 加载失败，尝试内嵌数据", err);
    }

    if (window.POETRY_LANDSCAPE_DATA) {
      applyData(window.POETRY_LANDSCAPE_DATA);
      return;
    }

    if (subtitleEl) subtitleEl.textContent = "古建智寻 · 加载失败";
    if (mapEl) {
      mapEl.innerHTML =
        '<p style="color:rgba(255,255,255,.6);text-align:center;padding:2rem">加载失败，请确认已运行 node server.mjs<br><button type="button" onclick="PoetryLandscape.reload()" style="margin-top:1rem;padding:.5rem 1rem;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;cursor:pointer">重试</button></p>';
    }
  }

  function getFilteredBuildings() {
    if (!landscapeData) return [];
    let list = landscapeData.buildings || [];

    if (activeTheme !== "all") {
      var theme = null;
      (landscapeData.themes || []).forEach(function (t) {
        if (t.id === activeTheme) theme = t;
      });
      if (theme && theme.provinces) {
        list = list.filter(function (b) {
          return theme.provinces.indexOf(b.province) >= 0;
        });
      }
    }
    if (activeProvince !== "all") {
      list = list.filter(function (b) {
        return b.province === activeProvince;
      });
    }
    return list;
  }

  function renderThemeFilters() {
    if (!themeFiltersEl || !landscapeData) return;
    themeFiltersEl.innerHTML = "";
    var themes = landscapeData.themes || [{ id: "all", label: "华夏全景" }];
    themes.forEach(function (theme) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "poetry-landscape__filter-btn" + (activeTheme === theme.id ? " is-active" : "");
      btn.textContent = theme.label;
      btn.addEventListener("click", function () {
        activeTheme = theme.id;
        activeProvince = "all";
        renderThemeFilters();
        renderProvinceTabs();
        renderMap();
      });
      themeFiltersEl.appendChild(btn);
    });
  }

  function renderProvinceTabs() {
    if (!provinceTabsEl || !landscapeData) return;
    provinceTabsEl.innerHTML = "";
    var buildings = getFilteredBuildings();
    var provinces = [];
    buildings.forEach(function (b) {
      if (provinces.indexOf(b.province) < 0) provinces.push(b.province);
    });
    provinces.sort();

    var allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "poetry-landscape__filter-btn" + (activeProvince === "all" ? " is-active" : "");
    allBtn.textContent = "全部";
    allBtn.addEventListener("click", function () {
      activeProvince = "all";
      renderProvinceTabs();
      renderMap();
    });
    provinceTabsEl.appendChild(allBtn);

    provinces.forEach(function (p) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "poetry-landscape__filter-btn" + (activeProvince === p ? " is-active" : "");
      btn.textContent = p;
      btn.addEventListener("click", function () {
        activeProvince = p;
        renderProvinceTabs();
        renderMap();
      });
      provinceTabsEl.appendChild(btn);
    });
  }

  function getProvinceLayout(province) {
    var layout = { x: 50, y: 50 };
    (landscapeData.provinces || []).forEach(function (p) {
      if (p.name === province) layout = p;
    });
    return layout;
  }

  function renderMap() {
    if (!mapEl || !landscapeData) return;
    mapEl.innerHTML = "";
    var buildings = getFilteredBuildings();
    var byProvince = {};

    buildings.forEach(function (b) {
      if (!byProvince[b.province]) byProvince[b.province] = [];
      byProvince[b.province].push(b);
    });

    var provinces = Object.keys(byProvince).sort();

    provinces.forEach(function (province) {
      var list = byProvince[province];
      var layout = getProvinceLayout(province);
      var region = document.createElement("div");
      region.className =
        "poetry-landscape__region" + (activeProvince === province ? " is-highlight" : "");
      region.style.left = layout.x + "%";
      region.style.top = layout.y + "%";

      var label = document.createElement("div");
      label.className = "poetry-landscape__province-label";
      label.style.position = "relative";
      label.style.transform = "none";
      label.style.left = "auto";
      label.style.top = "auto";
      label.style.marginBottom = "0.15rem";
      label.textContent = province.replace(/(省|市|自治区|壮族|回族|维吾尔)/g, "");
      region.appendChild(label);

      var cluster = document.createElement("div");
      cluster.className = "poetry-landscape__cluster";

      list.forEach(function (b) {
        var col = document.createElement("div");
        col.className = "poetry-landscape__column";
        col.setAttribute("role", "button");
        col.setAttribute("tabindex", "0");

        var tag = document.createElement("span");
        tag.className = "poetry-landscape__building-tag";
        tag.textContent = b.name.replace(/^北京|^广东|^江西|^湖北|^湖南|^山西|^陕西|^四川|^云南|^贵州|^江苏|^浙江|^福建|^山东|^河南|^河北|^辽宁|^吉林|^黑龙江|^甘肃|^宁夏|^新疆|^西藏|^内蒙古|^广西|^海南|^重庆|^安徽|^天津|^上海|^台湾|^香港|^澳门/, "");
        col.appendChild(tag);

        var stack = document.createElement("div");
        stack.className = "poetry-landscape__poem-stack";
        (b.poems_preview || []).slice(0, 1).forEach(function (p) {
          var line = document.createElement("div");
          line.className = "poetry-landscape__poem-line";
          line.innerHTML = p.title + "<br><em>" + p.author + "</em>";
          line.addEventListener("click", function (e) {
            e.stopPropagation();
            showPoemDetail(p.id, b.name, b.province);
          });
          stack.appendChild(line);
        });
        col.appendChild(stack);

        col.addEventListener("click", function () {
          var first = (b.poems_preview || [])[0];
          if (first) showPoemDetail(first.id, b.name, b.province);
        });

        cluster.appendChild(col);
      });

      region.appendChild(cluster);
      mapEl.appendChild(region);
    });

    if (!buildings.length) {
      mapEl.innerHTML =
        '<p style="color:rgba(255,255,255,.5);text-align:center;padding:3rem">该筛选下暂无诗词</p>';
    }
  }

  async function showPoemDetail(poemId, buildingName, province) {
    if (!detailEl) return;
    try {
      var resp = await fetch(POEM_API + "/" + poemId);
      if (!resp.ok) throw new Error("not found");
      var poem = await resp.json();
      if (detailTitle) detailTitle.textContent = poem.title;
      if (detailMeta) detailMeta.textContent = "〔" + (poem.dynasty || "") + "〕" + poem.author;
      if (detailContent) detailContent.textContent = poem.content;
      if (detailBuilding) detailBuilding.textContent = buildingName + " · " + province;
      detailEl.classList.add("is-visible");
    } catch (err) {
      console.error(err);
    }
  }

  function hideDetail() {
    if (detailEl) detailEl.classList.remove("is-visible");
  }

  var closeBtn = document.getElementById("plCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", close);

  var openBtn = document.getElementById("openPoetryLandscapeBtn");
  if (openBtn) openBtn.addEventListener("click", open);

  var navBtn = document.getElementById("indexNavPoetryMap");
  if (navBtn) {
    var navHref = navBtn.getAttribute("href") || "";
    if (!navHref || navHref === "#") {
      navBtn.addEventListener("click", function (e) {
        e.preventDefault();
        open();
      });
    }
  }

  root.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && root.classList.contains("is-open")) close();
  });

  window.PoetryLandscape = { open: open, close: close, reload: loadData };

  // 独立页面（poetry-map.html）：脚本在 body 末尾，直接加载数据
  if (root.classList.contains("poetry-landscape--page")) {
    open();
  }
})();
