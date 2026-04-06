(function () {
  "use strict";

  const API_BASE = window.AI_GUIDE_API_BASE || "http://127.0.0.1:8000";
  const STYLE_ID = "ai-guide-widget-style-v3";

  /* ─── Styles ─────────────────────────────────────────────────── */
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* ── Trigger avatar (bottom-left) ────────────────────────── */
      .aig-trigger {
        position: fixed;
        left: 20px;
        bottom: 20px;
        z-index: 9998;
        width: 90px;
        height: 90px;
        border-radius: 50%;
        border: none;
        padding: 0;
        cursor: pointer;
        background: transparent;
        outline: none;
        overflow: visible;
        opacity: 1;
        filter: drop-shadow(0 4px 14px rgba(0,0,0,.55));
        transition: transform .28s cubic-bezier(.22,.68,0,1.2), filter .3s ease;
      }
      .aig-trigger:hover {
        transform: scale(1.08) translateY(-3px);
        filter: drop-shadow(0 8px 22px rgba(0,0,0,.6)) drop-shadow(0 0 14px rgba(212,175,55,.4));
      }
      /* 底部阴影底座，hover 时出现 */
      .aig-trigger::before {
        content: '';
        position: absolute;
        left: 50%; bottom: -5px;
        transform: translateX(-50%);
        width: 56px; height: 14px;
        border-radius: 50%;
        background: rgba(0,0,0,.35);
        filter: blur(4px);
        opacity: 0;
        transition: opacity .3s;
        pointer-events: none;
      }
      .aig-trigger:hover::before { opacity: 1; }
      /* 金色脉冲环，hover 时激活 */
      .aig-trigger::after {
        content: '';
        position: absolute;
        inset: -5px;
        border-radius: 50%;
        border: 2px solid rgba(212,175,55,0);
        transition: border-color .3s;
        pointer-events: none;
      }
      .aig-trigger:hover::after {
        border-color: rgba(212,175,55,.5);
        animation: aig-pulse 2.4s ease-out infinite;
      }
      @keyframes aig-pulse {
        0%   { opacity:.9; transform:scale(1); }
        70%  { opacity:0;  transform:scale(1.55); }
        100% { opacity:0;  transform:scale(1.55); }
      }
      .aig-trigger img {
        width: 100%; height: 100%;
        border-radius: 50%;
        object-fit: cover; object-position: center 18%;
        display: block;
        pointer-events: none;
        border: 2px solid rgba(212,175,55,.6);
        box-sizing: border-box;
        background: rgba(10,8,20,.5);
      }

      /* Hover tooltip */
      .aig-hover-tip {
        position: fixed;
        left: 120px;
        bottom: 38px;
        z-index: 9999;
        background: rgba(10,8,20,.9);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid rgba(212,175,55,.28);
        border-radius: 20px;
        color: #f5e8b5;
        font-size: 12.5px;
        padding: 6px 14px;
        white-space: nowrap;
        box-shadow: 0 4px 16px rgba(0,0,0,.4);
        pointer-events: none;
        opacity: 0;
        transform: translateX(-8px);
        transition: opacity .22s, transform .22s;
      }
      .aig-hover-tip.visible {
        opacity: 1;
        transform: translateX(0);
      }

      /* ── Glass panel ─────────────────────────────────────────── */
      .aig-panel {
        position: fixed;
        left: 20px;
        bottom: 122px;
        width: 400px;
        height: 560px;
        min-width: 280px;
        min-height: 360px;
        max-width: calc(100vw - 40px);
        max-height: calc(100vh - 100px);
        z-index: 9999;
        border-radius: 18px;
        overflow: hidden;
        display: none;
        flex-direction: column;
        background: rgba(8, 6, 18, 0.6);
        backdrop-filter: blur(28px) saturate(180%);
        -webkit-backdrop-filter: blur(28px) saturate(180%);
        border: 1px solid rgba(212,175,55,.25);
        box-shadow:
          0 10px 50px rgba(0,0,0,.65),
          0 0 0 1px rgba(255,255,255,.04) inset,
          0 1px 0 rgba(212,175,55,.18) inset;
        transform-origin: bottom left;
      }
      .aig-panel.aig-open {
        display: flex;
        animation: aig-slideup .28s cubic-bezier(.22,.68,0,1.18);
      }
      @keyframes aig-slideup {
        from { opacity:0; transform:scale(.93) translateY(10px); }
        to   { opacity:1; transform:scale(1)   translateY(0); }
      }

      /* Resize handle — top-right corner */
      .aig-resize-handle {
        position: absolute;
        top: 0; right: 0;
        width: 32px; height: 32px;
        cursor: nwse-resize;
        z-index: 10;
        display: flex; align-items: flex-start; justify-content: flex-end;
        padding: 6px 6px 0 0;
        opacity: 0;
        transition: opacity .2s;
      }
      .aig-panel:hover .aig-resize-handle { opacity: 1; }
      .aig-resize-handle svg { pointer-events: none; }

      /* Header */
      .aig-header {
        display: flex; align-items: center; gap: 10px;
        padding: 12px 14px 10px;
        border-bottom: 1px solid rgba(212,175,55,.15);
        background: rgba(212,175,55,.05);
        flex-shrink: 0;
        user-select: none;
        cursor: default;
      }
      .aig-header-avatar {
        width: 36px; height: 36px;
        border-radius: 50%;
        object-fit: cover; object-position: center 18%;
        border: 1.5px solid rgba(212,175,55,.55);
        box-shadow: 0 0 8px rgba(212,175,55,.22);
        flex-shrink: 0;
      }
      .aig-header-info { flex:1; min-width:0; }
      .aig-header-name {
        font-size: 14px; font-weight:700; color:#f5e8b5;
        letter-spacing:.04em;
        font-family:"Noto Serif SC","Ma Shan Zheng",serif;
      }
      .aig-header-sub { font-size:10.5px; color:rgba(212,175,55,.65); margin-top:1px; }
      .aig-header-btns { display:flex; gap:6px; flex-shrink:0; }
      .aig-icon-btn {
        width:26px; height:26px; border-radius:50%;
        border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.06);
        color:rgba(255,255,255,.55);
        font-size:12px; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        transition:background .18s, color .18s;
        outline:none; flex-shrink:0;
      }
      .aig-icon-btn:hover { background:rgba(255,255,255,.14); color:#fff; }
      .aig-icon-btn.close:hover { background:rgba(255,50,50,.22); }

      /* Messages */
      .aig-messages {
        flex:1; overflow-y:auto;
        padding:14px 12px;
        display:flex; flex-direction:column; gap:10px;
        scroll-behavior:smooth;
      }
      .aig-messages::-webkit-scrollbar { width:3px; }
      .aig-messages::-webkit-scrollbar-thumb { background:rgba(212,175,55,.28); border-radius:4px; }

      /* Bubbles */
      .aig-msg {
        max-width:88%; padding:9px 12px;
        border-radius:14px; font-size:13px; line-height:1.68;
        word-break:break-word; animation:aig-fadein .18s ease;
      }
      @keyframes aig-fadein {
        from{opacity:0;transform:translateY(4px)}
        to  {opacity:1;transform:translateY(0)}
      }
      .aig-msg.user {
        align-self:flex-end;
        background:rgba(212,175,55,.2);
        border:1px solid rgba(212,175,55,.28);
        color:#f8ebbf;
        border-bottom-right-radius:4px;
      }
      .aig-msg.assistant {
        align-self:flex-start;
        background:rgba(255,255,255,.08);
        border:1px solid rgba(255,255,255,.09);
        color:#e5e5f0;
        border-bottom-left-radius:4px;
      }
      .aig-msg.thinking { color:rgba(255,255,255,.38); font-style:italic; }
      .aig-cursor::after {
        content:'▋'; animation:aig-blink .7s step-end infinite;
        color:#d4af37; margin-left:2px;
      }
      @keyframes aig-blink{0%,100%{opacity:1}50%{opacity:0}}

      /* Markdown content */
      .aig-msg-content strong { color:#f5d870; font-weight:700; }
      .aig-msg-content em { color:rgba(240,220,175,.85); font-style:italic; }
      .aig-msg-content p { margin:0 0 5px; }
      .aig-msg-content p:last-child { margin-bottom:0; }

      /* Inline citation badge */
      .aig-cite {
        display:inline-flex; align-items:center; justify-content:center;
        width:17px; height:17px; border-radius:50%;
        background:rgba(212,175,55,.22);
        border:1px solid rgba(212,175,55,.48);
        color:#d4af37; font-size:9.5px; font-weight:700;
        line-height:1; cursor:pointer; vertical-align:middle;
        margin:0 2px; position:relative;
        transition:background .18s, transform .15s;
        flex-shrink:0;
      }
      .aig-cite:hover { background:rgba(212,175,55,.42); transform:scale(1.18); }

      /* Citation hover card */
      .aig-cite-card {
        position:absolute;
        bottom:calc(100% + 8px);
        left:50%; transform:translateX(-50%);
        width:240px;
        background:rgba(10,8,22,.94);
        backdrop-filter:blur(20px) saturate(160%);
        -webkit-backdrop-filter:blur(20px) saturate(160%);
        border:1px solid rgba(212,175,55,.32);
        border-radius:12px;
        padding:11px 13px 10px;
        box-shadow:0 8px 28px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04) inset;
        z-index:10020;
        animation:aig-fadein .16s ease;
        white-space:normal;
        text-align:left;
      }
      .aig-cite-card::after {
        content:''; position:absolute;
        top:100%; left:50%; transform:translateX(-50%);
        border:6px solid transparent;
        border-top-color:rgba(212,175,55,.32);
      }
      .aig-cite-card-title {
        font-size:11.5px; font-weight:700; color:#f5e8b5;
        margin-bottom:5px; line-height:1.4;
      }
      .aig-cite-card-excerpt {
        font-size:10.5px; color:rgba(215,205,180,.65);
        line-height:1.55; margin-bottom:8px;
        display:-webkit-box; -webkit-line-clamp:4;
        -webkit-box-orient:vertical; overflow:hidden;
      }
      .aig-cite-card-dl {
        display:flex; align-items:center; justify-content:center; gap:5px;
        background:rgba(212,175,55,.16);
        border:1px solid rgba(212,175,55,.38);
        border-radius:7px; padding:5px 10px;
        font-size:11px; color:#d4af37;
        text-decoration:none; transition:background .18s;
        pointer-events:auto;
      }
      .aig-cite-card-dl:hover { background:rgba(212,175,55,.3); }

      /* Reference list below answer */
      .aig-refs {
        margin-top:8px; padding:9px 11px;
        background:rgba(212,175,55,.06);
        border:1px solid rgba(212,175,55,.18);
        border-radius:10px; font-size:11.5px;
        align-self:flex-start;
        max-width:88%;
      }
      .aig-refs-title {
        color:rgba(212,175,55,.75); font-weight:600;
        margin-bottom:5px; font-size:11px; letter-spacing:.04em;
      }
      .aig-ref-item {
        display:flex; align-items:center; gap:7px;
        padding:4px 0; border-bottom:1px solid rgba(255,255,255,.05);
        color:rgba(235,220,190,.7);
      }
      .aig-ref-item:last-child { border-bottom:none; padding-bottom:0; }
      .aig-ref-num {
        width:18px; height:18px; border-radius:50%;
        background:rgba(212,175,55,.18); color:#d4af37;
        font-size:9px; font-weight:700;
        display:flex; align-items:center; justify-content:center; flex-shrink:0;
      }
      .aig-ref-label {
        flex:1; min-width:0; overflow:hidden;
        text-overflow:ellipsis; white-space:nowrap;
        font-size:11px;
      }
      .aig-ref-dl {
        flex-shrink:0; display:flex; align-items:center; gap:3px;
        background:rgba(212,175,55,.13);
        border:1px solid rgba(212,175,55,.28);
        border-radius:5px; padding:2px 7px;
        font-size:10.5px; color:#d4af37;
        text-decoration:none; transition:background .18s; white-space:nowrap;
      }
      .aig-ref-dl:hover { background:rgba(212,175,55,.26); }

      /* Input bar */
      .aig-input-bar {
        display:flex; gap:7px; padding:10px 12px;
        border-top:1px solid rgba(212,175,55,.12);
        background:rgba(0,0,0,.15); flex-shrink:0;
      }
      .aig-input-bar textarea {
        flex:1; background:rgba(255,255,255,.06);
        border:1px solid rgba(212,175,55,.18);
        border-radius:11px; padding:8px 11px;
        color:#f0f0f0; font-size:12.5px;
        font-family:"Noto Sans SC",system-ui,sans-serif;
        resize:none; outline:none;
        height:38px; max-height:110px;
        transition:border-color .18s; line-height:1.5;
      }
      .aig-input-bar textarea:focus { border-color:rgba(212,175,55,.45); }
      .aig-input-bar textarea::placeholder { color:rgba(255,255,255,.28); }
      .aig-send-btn {
        width:38px; height:38px; border-radius:11px;
        background:linear-gradient(135deg,#d4af37 0%,#b8942a 100%);
        border:none; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        flex-shrink:0;
        box-shadow:0 2px 10px rgba(212,175,55,.3);
        transition:opacity .18s, transform .14s; outline:none;
      }
      .aig-send-btn:hover { opacity:.88; transform:scale(1.06); }
      .aig-send-btn:disabled { opacity:.4; cursor:not-allowed; transform:none; }
      .aig-send-btn svg { width:16px; height:16px; fill:#1b1300; }
    `;
    document.head.appendChild(style);
  }

  /* ─── State ──────────────────────────────────────────────────── */
  let panelOpen = false;
  let currentLang = "zh";
  let sending = false;

  function detectLang() {
    const s = localStorage.getItem("aig_lang") || document.documentElement.getAttribute("lang") || "zh";
    return s.toLowerCase().startsWith("en") ? "en" : "zh";
  }

  /* ─── Markdown + citation renderer ───────────────────────────── */
  function esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
  function renderMarkdown(raw, refs) {
    const lines = (raw || "").split("\n");
    const out = lines.map(line => {
      line = esc(line);
      line = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      line = line.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
      line = line.replace(/\[(\d+)\]/g, (_, n) => {
        const idx = parseInt(n, 10);
        const ref = refs ? refs.find(r => r.index === idx) : null;
        const da = ref
          ? ` data-title="${esc(ref.source || ref.building || "文献")}" data-excerpt="${esc((ref.content||"").slice(0,200))}" data-path="${encodeURIComponent(ref.relative_path||"")}"`
          : "";
        return `<span class="aig-cite"${da}>${n}</span>`;
      });
      return line;
    });
    const html = out.join("\n").replace(/\n{2,}/g,"</p><p>").replace(/\n/g,"<br>");
    return `<span class="aig-msg-content"><p>${html}</p></span>`;
  }

  /* ─── Build widget ───────────────────────────────────────────── */
  function createWidget() {
    ensureStyle();
    currentLang = detectLang();

    /* Trigger */
    const trigger = document.createElement("button");
    trigger.className = "aig-trigger";
    trigger.title = "古建智寻 AI 导览员";
    trigger.innerHTML = `<img src="./assets/guide-avatar.png" alt="AI导览"
      onerror="this.parentNode.innerHTML='<span style=\\'font-size:24px;line-height:52px;display:block;text-align:center;\\'>🏯</span>'" />`;
    document.body.appendChild(trigger);

    /* Hover tip */
    const hoverTip = document.createElement("div");
    hoverTip.className = "aig-hover-tip";
    hoverTip.textContent = "有关古建筑的问题？问我吧 ✨";
    document.body.appendChild(hoverTip);

    trigger.addEventListener("mouseenter", () => hoverTip.classList.add("visible"));
    trigger.addEventListener("mouseleave", () => hoverTip.classList.remove("visible"));

    /* Panel */
    const panel = document.createElement("div");
    panel.className = "aig-panel";
    panel.innerHTML = `
      <div class="aig-resize-handle" title="拖拽调整大小">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M12 2L2 12M8 2L2 8M12 6L6 12" stroke="rgba(212,175,55,.5)" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="aig-header">
        <img class="aig-header-avatar" src="./assets/guide-avatar.png" alt="AI"
          onerror="this.style.display='none'" />
        <div class="aig-header-info">
          <div class="aig-header-name">古建智寻 · AI 导览员</div>
          <div class="aig-header-sub">知识库检索 · 引用文献</div>
        </div>
        <div class="aig-header-btns">
          <button class="aig-icon-btn close" title="关闭">✕</button>
        </div>
      </div>
      <div class="aig-messages" id="aigMessages">
        <div class="aig-msg assistant">你好！我是古建智寻 AI 导览员 🏯<br>可以向我提问关于古建筑的历史、结构、文化等任何问题，我会引用知识库文献为你解答。</div>
      </div>
      <div class="aig-input-bar">
        <textarea id="aigInput" placeholder="请输入关于古建筑的问题…" rows="1"></textarea>
        <button class="aig-send-btn" id="aigSendBtn" title="发送">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    `;
    document.body.appendChild(panel);

    const msgBox  = panel.querySelector("#aigMessages");
    const input   = panel.querySelector("#aigInput");
    const sendBtn = panel.querySelector("#aigSendBtn");
    const closeBtn= panel.querySelector(".aig-icon-btn.close");
    const resizeH = panel.querySelector(".aig-resize-handle");

    /* ─── Open / close ─────────────────────────────────────────── */
    function setOpen(val) {
      panelOpen = !!val;
      panel.classList.toggle("aig-open", panelOpen);
      if (panelOpen) setTimeout(() => input.focus(), 60);
    }
    trigger.addEventListener("click", () => setOpen(!panelOpen));
    closeBtn.addEventListener("click", () => setOpen(false));

    /* ─── Resize (drag from top-right corner) ──────────────────── */
    let resizing = false, rsX, rsY, rsW, rsH;
    resizeH.addEventListener("mousedown", e => {
      e.preventDefault();
      resizing = true;
      rsX = e.clientX; rsY = e.clientY;
      rsW = panel.offsetWidth; rsH = panel.offsetHeight;
      document.body.style.userSelect = "none";
    });
    document.addEventListener("mousemove", e => {
      if (!resizing) return;
      const newW = Math.max(280, Math.min(rsW + (e.clientX - rsX), window.innerWidth - 40));
      const newH = Math.max(360, Math.min(rsH - (e.clientY - rsY), window.innerHeight - 100));
      panel.style.width  = newW + "px";
      panel.style.height = newH + "px";
    });
    document.addEventListener("mouseup", () => {
      if (resizing) { resizing = false; document.body.style.userSelect = ""; }
    });

    /* ─── Textarea auto-resize ─────────────────────────────────── */
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 110) + "px";
    });

    /* ─── Append bubble ────────────────────────────────────────── */
    function appendMsg(role, text, extra) {
      const div = document.createElement("div");
      div.className = "aig-msg " + role + (extra ? " " + extra : "");
      if (role === "user") div.textContent = text;
      else div.innerHTML = text ? renderMarkdown(text, []) : "";
      msgBox.appendChild(div);
      msgBox.scrollTop = msgBox.scrollHeight;
      return div;
    }

    /* ─── Bind citation hover cards ────────────────────────────── */
    function bindCites(container, refs) {
      container.querySelectorAll(".aig-cite").forEach(badge => {
        const idx = parseInt(badge.textContent, 10);
        const ref = refs.find(r => r.index === idx);
        if (!ref) return;
        let card = null;
        const dlUrl = API_BASE + "/api/files/" + encodeURIComponent(ref.relative_path || "");
        function show() {
          if (card) return;
          card = document.createElement("div");
          card.className = "aig-cite-card";
          card.innerHTML = `
            <div class="aig-cite-card-title">📄 ${esc(ref.source || ref.building || "参考文献")}</div>
            <div class="aig-cite-card-excerpt">${esc((ref.content || "").slice(0, 200))}…</div>
            <a class="aig-cite-card-dl" href="${dlUrl}" target="_blank" rel="noopener">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>下载 PDF
            </a>`;
          badge.appendChild(card);
          card.addEventListener("mouseleave", hide);
        }
        function hide(e) {
          if (e && badge.contains(e.relatedTarget)) return;
          if (card) { card.remove(); card = null; }
        }
        badge.addEventListener("mouseenter", show);
        badge.addEventListener("mouseleave", e => {
          if (card && card.contains(e.relatedTarget)) return;
          hide();
        });
      });
    }

    /* ─── Render reference list ────────────────────────────────── */
    function renderRefs(refs) {
      if (!refs || !refs.length) return null;
      const wrap = document.createElement("div");
      wrap.className = "aig-refs";
      const title = document.createElement("div");
      title.className = "aig-refs-title";
      title.textContent = "📚 参考文献";
      wrap.appendChild(title);
      refs.forEach(r => {
        const item = document.createElement("div");
        item.className = "aig-ref-item";
        const num = document.createElement("div");
        num.className = "aig-ref-num";
        num.textContent = r.index;
        const label = document.createElement("div");
        label.className = "aig-ref-label";
        label.title = r.source || "";
        label.textContent = [r.building, r.source].filter(Boolean).join(" · ") || "文献";
        const dl = document.createElement("a");
        dl.className = "aig-ref-dl";
        dl.href = API_BASE + "/api/files/" + encodeURIComponent(r.relative_path || "");
        dl.target = "_blank"; dl.rel = "noopener";
        dl.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>下载`;
        item.append(num, label, dl);
        wrap.appendChild(item);
      });
      return wrap;
    }

    /* ─── Send ─────────────────────────────────────────────────── */
    async function ask() {
      if (sending) return;
      const q = (input.value || "").trim();
      if (!q) return;
      input.value = ""; input.style.height = "auto";
      sending = true; sendBtn.disabled = true;

      appendMsg("user", q);
      const answerEl = appendMsg("assistant", "思考中…", "thinking aig-cursor");
      let refs = [], answerText = "", firstToken = true;

      try {
        const resp = await fetch(API_BASE + "/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, lang: currentLang, history: [] }),
        });
        if (!resp.body) throw new Error("no stream");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buf = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const events = buf.split("\n\n");
          buf = events.pop() || "";
          for (const ev of events) {
            const line = ev.split("\n").find(l => l.startsWith("data: "));
            if (!line) continue;
            let p; try { p = JSON.parse(line.slice(6)); } catch { continue; }
            if (p.type === "kb_sources") {
              refs = p.data || [];
            } else if (p.type === "token") {
              const piece = p.data || "";
              if (firstToken && piece.length) {
                firstToken = false;
                answerEl.innerHTML = "";
                answerEl.classList.remove("thinking");
              }
              answerText += piece;
              answerEl.textContent = answerText;
              msgBox.scrollTop = msgBox.scrollHeight;
            } else if (p.type === "error") {
              answerEl.textContent = "出错：" + (p.data || "未知错误");
              answerEl.classList.remove("thinking", "aig-cursor");
            }
          }
        }

        answerEl.classList.remove("aig-cursor");
        if (firstToken) {
          answerEl.textContent = "暂无回答，请确认后端服务已启动。";
          answerEl.classList.remove("thinking");
        } else {
          // Final render: markdown + citation badges
          answerEl.innerHTML = renderMarkdown(answerText, refs);
          bindCites(answerEl, refs);
        }
        // Append reference list as sibling after the answer bubble
        const refsEl = renderRefs(refs);
        if (refsEl) {
          msgBox.appendChild(refsEl);
          msgBox.scrollTop = msgBox.scrollHeight;
        }
      } catch {
        answerEl.textContent = "连接失败，请确认后端已在 http://127.0.0.1:8000 启动。";
        answerEl.classList.remove("thinking", "aig-cursor");
      } finally {
        sending = false; sendBtn.disabled = false; input.focus();
      }
    }

    sendBtn.addEventListener("click", ask);
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createWidget);
  } else {
    createWidget();
  }
})();
