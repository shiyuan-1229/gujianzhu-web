/**
 * 全站统一语言偏好：localStorage 单键 + 旧键迁移；URL ?lang= 优先并写回存储。
 */
(function () {
  var SITE_KEY = "gujianzhu_site_lang";
  var LEGACY_KEYS = [
    "__INDEX_LANG__",
    "__LIST_LANG__",
    "__DETAIL_LANG__",
    "__GUGONG_EXPLORE_LANG__",
    "__GUGONG_PALACE_MAP_LANG__",
    "__EXPLORE_LANG__",
  ];
  var URL_MAP = { zh: "zh", "zh-cn": "zh", en: "en", "en-us": "en" };

  function fromUrl() {
    try {
      var params = new URLSearchParams(window.location.search || "");
      var raw = (params.get("lang") || "").trim().toLowerCase();
      return URL_MAP[raw] || null;
    } catch (e) {
      return null;
    }
  }

  function persist(lang) {
    if (lang !== "zh" && lang !== "en") return;
    try {
      localStorage.setItem(SITE_KEY, lang);
    } catch (e) {}
  }

  function migrateLegacy() {
    try {
      var cur = localStorage.getItem(SITE_KEY);
      if (cur === "zh" || cur === "en") return cur;
    } catch (e) {}
    for (var i = 0; i < LEGACY_KEYS.length; i++) {
      try {
        var o = localStorage.getItem(LEGACY_KEYS[i]);
        if (o === "zh" || o === "en") {
          persist(o);
          return o;
        }
      } catch (e2) {}
    }
    return null;
  }

  function resolveSiteLang() {
    var u = fromUrl();
    if (u) {
      persist(u);
      return u;
    }
    var m = migrateLegacy();
    if (m) return m;
    return "zh";
  }

  window.GUJIANZHU_SITE_LANG_KEY = SITE_KEY;
  window.resolveSiteLang = resolveSiteLang;
  window.persistSiteLang = persist;
})();
