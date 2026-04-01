const toggle = document.querySelector(".theme-toggle");
const stored = localStorage.getItem("theme");

if (stored) {
  document.documentElement.setAttribute("data-theme", stored);
}

function updateIcon() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  toggle.textContent = isDark ? "\u2600" : "\u263E";
}

toggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next || "default");
  updateIcon();
});

updateIcon();

// Reading time (half actual time)
const postContent = document.querySelector(".post-content");
const postMeta = document.querySelector(".post-meta");
if (postContent && postMeta) {
  const text = postContent.textContent || "";
  const chars = text.replace(/\s+/g, "").length;
  const minutes = Math.max(1, Math.round(chars / 600 / 2));
  const span = document.createElement("span");
  span.className = "reading-time";
  var isEn = location.pathname.indexOf("/posts/en/") !== -1;
  span.textContent = isEn ? minutes + " min read" : "読了：" + minutes + "分";
  postMeta.appendChild(span);

  // Copy as Markdown button
  const path = location.pathname.replace(/\/$/, "");
  const slug = path.split("/").pop();
  const mdUrl = "https://raw.githubusercontent.com/Flowers-of-Romance/poptones/main/posts/" + slug + ".md";
  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-page-btn";
  copyBtn.setAttribute("data-md-url", mdUrl);
  copyBtn.title = "記事をMarkdownでコピー";
  copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  postMeta.appendChild(copyBtn);

  document.addEventListener("click", function(e) {
    var btn = e.target.closest(".copy-page-btn");
    if (!btn) return;
    e.preventDefault();
    fetch(btn.getAttribute("data-md-url"))
      .then(function(r) { return r.text(); })
      .then(function(t) {
        // parse original frontmatter
        var fmMatch = t.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
        var body = fmMatch ? t.slice(fmMatch[0].length) : t;
        // strip template HTML (post-content div, post-meta, post-note, closing div)
        body = body.replace(/<div class="post-content">\s*/g, "");
        body = body.replace(/<div class="post-meta">[\s\S]*?<\/div>\s*/g, "");
        body = body.replace(/<p class="post-note">[\s\S]*?<\/p>\s*/g, "");
        body = body.replace(/\n<\/div>\s*$/, "\n");

        // extract title from frontmatter
        var titleMatch = fmMatch && fmMatch[1].match(/title:\s*(.+)/);
        var title = titleMatch ? titleMatch[1].trim() : document.title;

        // extract tags from post-meta
        var tags = [];
        document.querySelectorAll(".post-meta .tag").forEach(function(el) {
          tags.push(el.textContent.trim());
        });

        // extract date from post-meta
        var dateEl = document.querySelector(".post-meta .date, .post-meta span:first-child");
        var dateMatch = dateEl && dateEl.textContent.match(/(\d{4})年(\d{2})月(\d{2})日/);
        var date = dateMatch ? dateMatch[1] + "-" + dateMatch[2] + "-" + dateMatch[3] : "";

        // description: random sentence from body
        var sentences = [];
        body.split("\n").forEach(function(line) {
          line = line.trim();
          if (!line || line.charAt(0) === "<" || line.charAt(0) === "#" || line === "---") return;
          if (line.charAt(0) === "|") return;
          line.replace(/[^。．.！!]+[。．.！!]/g, function(m) {
            var s = m.replace(/\*\*/g, "").trim();
            if (s.length > 10 && s.length < 120) sentences.push(s);
          });
        });
        var description = sentences.length
          ? sentences[Math.floor(Math.random() * sentences.length)]
          : "";

        var newFm = "---\n";
        newFm += 'url: ' + location.href + "\n";
        newFm += 'title: "' + title.replace(/"/g, '\\"') + '"\n';
        newFm += 'description: "' + description.replace(/"/g, '\\"') + '"\n';
        newFm += "date: " + date + "\n";
        newFm += "tags: [" + tags.join(", ") + "]\n";
        newFm += "author: 人工無能ちゃん\n";
        newFm += "---\n\n";

        return navigator.clipboard.writeText(newFm + body);
      })
      .then(function() {
        var origHTML = btn.innerHTML;
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
        btn.classList.add("copied");
        setTimeout(function() {
          btn.innerHTML = origHTML;
          btn.classList.remove("copied");
        }, 1500);
      });
  });
}

// Action sidebar (injected via JS to avoid layout interference)
(function() {
  if (!document.querySelector(".post-content")) return;
  if (window.innerWidth < 1360) return;

  const sidebar = document.createElement("aside");
  sidebar.className = "action-sidebar";
  sidebar.innerHTML = `
    <div class="action-bar">
      <button class="action-btn like-btn" aria-label="いいね">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <span class="action-count">0</span>
      </button>
      <button class="action-btn bookmark-btn" aria-label="ブックマーク">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
      </button>
      <button class="action-btn x-btn" aria-label="X">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </button>
      <button class="action-btn facebook-btn" aria-label="Facebook">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      </button>
      <a class="action-btn hatena-btn" aria-label="はてなブックマーク" href="https://b.hatena.ne.jp/entry/panel/?url=${encodeURIComponent(location.href)}&title=${encodeURIComponent(document.title)}" target="_blank" rel="nofollow noopener noreferrer">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.47 21.23c-.45.45-1.08.67-1.9.67s-1.45-.22-1.9-.67c-.45-.45-.67-1.08-.67-1.9s.22-1.45.67-1.9c.45-.45 1.08-.67 1.9-.67s1.45.22 1.9.67c.45.45.67 1.08.67 1.9s-.22 1.45-.67 1.9zM16.8 3h3.4v11.4h-3.4V3zM3.15 21.23V3h5.33c1.8 0 3.15.35 4.06 1.06.91.7 1.36 1.77 1.36 3.2 0 .96-.23 1.76-.68 2.4-.45.64-1.1 1.07-1.94 1.3v.1c1.02.2 1.78.65 2.28 1.35.5.7.75 1.58.75 2.63 0 1.52-.5 2.7-1.49 3.53-.99.83-2.37 1.24-4.14 1.24H3.15zm3.4-10.7h2.2c1.02 0 1.77-.2 2.24-.59.47-.39.71-.99.71-1.82 0-.76-.26-1.32-.78-1.68-.52-.36-1.31-.54-2.39-.54H6.55v4.63zm0 2.56v5.2h2.53c1.06 0 1.85-.24 2.37-.71.52-.47.78-1.17.78-2.1 0-.87-.27-1.53-.82-1.97-.55-.44-1.37-.66-2.46-.66H6.55z"/></svg>
      </a>
    </div>`;
  document.body.appendChild(sidebar);

  function showBubble(btn, msg) {
    const existing = sidebar.querySelector(".action-bubble");
    if (existing) existing.remove();
    const bubble = document.createElement("div");
    bubble.className = "action-bubble";
    bubble.textContent = msg;
    btn.style.position = "relative";
    btn.appendChild(bubble);
    setTimeout(() => bubble.remove(), 2200);
  }

  const style = document.createElement("style");
  style.textContent = `
    .action-bubble {
      position: absolute;
      left: calc(100% + 10px);
      top: 50%;
      transform: translateY(-50%);
      background: var(--card-bg);
      color: var(--text);
      border: 1px solid var(--card-border);
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      font-size: 0.8rem;
      white-space: nowrap;
      z-index: 999;
      animation: fadeout 2.2s forwards;
    }
    .action-bubble::before {
      content: "";
      position: absolute;
      right: 100%;
      top: 50%;
      transform: translateY(-50%);
      border: 5px solid transparent;
      border-right-color: var(--card-border);
    }
    @keyframes fadeout{0%,70%{opacity:1}100%{opacity:0}}`;
  document.head.appendChild(style);

  sidebar.querySelector(".like-btn").addEventListener("click", function() { showBubble(this, "そんな機能はないよ"); });
  sidebar.querySelector(".bookmark-btn").addEventListener("click", function() { showBubble(this, "そんな機能はないよ"); });
  sidebar.querySelector(".x-btn").addEventListener("click", function() { showBubble(this, "Twitterはちょっと"); });
  sidebar.querySelector(".facebook-btn").addEventListener("click", function() { showBubble(this, "Facebookはちょっと"); });
})();

// Radix toggle (hex / binary)
(function() {
  var hexBtn = document.querySelector(".hex-toggle");
  var binBtn = document.querySelector(".bin-toggle");
  if (!hexBtn && !binBtn) return;

  var activeMode = null; // "hex" | "bin" | null
  var saved = [];

  function getTextNodes(el) {
    var nodes = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      var n = walker.currentNode;
      var tag = n.parentElement && n.parentElement.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "CODE" || tag === "PRE") continue;
      if (n.parentElement.closest(".hex-toggle, .bin-toggle, .theme-toggle, .muno-chat, .lang-switch")) continue;
      if (n.textContent.trim()) nodes.push(n);
    }
    return nodes;
  }

  function convert(text, radix, pad) {
    var out = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === " " || ch === "\n" || ch === "\t") { out.push(ch); continue; }
      var cp = text.codePointAt(i);
      if (cp > 0xFFFF) i++;
      out.push(cp.toString(radix).toUpperCase().padStart(pad, "0"));
    }
    return out.join(" ");
  }

  function restore() {
    saved.forEach(function(s) { s.node.textContent = s.text; });
    saved = [];
    if (hexBtn) hexBtn.classList.remove("active");
    if (binBtn) binBtn.classList.remove("active");
    activeMode = null;
  }

  function apply(mode, radix, pad, btn) {
    if (activeMode) restore();
    if (activeMode === mode) return; // was toggling off
    saved = [];
    var nodes = getTextNodes(document.body);
    nodes.forEach(function(n) {
      saved.push({ node: n, text: n.textContent });
      n.textContent = convert(n.textContent, radix, pad);
    });
    btn.classList.add("active");
    activeMode = mode;
  }

  // Dump mode
  var dumpBtn = document.querySelector(".dump-toggle");
  var dumpOverlay = null;

  function textToUtf8Bytes(text) {
    var bytes = [];
    for (var i = 0; i < text.length; i++) {
      var cp = text.codePointAt(i);
      if (cp > 0xFFFF) i++;
      if (cp < 0x80) { bytes.push(cp); }
      else if (cp < 0x800) { bytes.push(0xC0 | (cp >> 6), 0x80 | (cp & 0x3F)); }
      else if (cp < 0x10000) { bytes.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F)); }
      else { bytes.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F)); }
    }
    return bytes;
  }

  function hexdump(text) {
    var bytes = textToUtf8Bytes(text);
    var lines = [];
    for (var off = 0; off < bytes.length; off += 16) {
      var chunk = bytes.slice(off, off + 16);
      var addr = off.toString(16).toUpperCase().padStart(8, "0");
      var hex = [];
      for (var j = 0; j < 16; j++) {
        if (j < chunk.length) hex.push(chunk[j].toString(16).toUpperCase().padStart(2, "0"));
        else hex.push("  ");
      }
      var hexStr = hex.slice(0,8).join(" ") + "  " + hex.slice(8).join(" ");
      var ascii = "";
      for (var j = 0; j < chunk.length; j++) {
        var b = chunk[j];
        ascii += (b >= 0x20 && b < 0x7F) ? String.fromCharCode(b) : ".";
      }
      lines.push(addr + "  " + hexStr + "  |" + ascii + "|");
    }
    return lines.join("\n");
  }

  function showDump() {
    var text = "";
    var nodes = getTextNodes(document.body);
    nodes.forEach(function(n) { text += n.textContent; });
    dumpOverlay = document.createElement("div");
    dumpOverlay.className = "dump-overlay";
    dumpOverlay.textContent = hexdump(text);
    dumpOverlay.addEventListener("click", function() { hideDump(); });
    document.body.appendChild(dumpOverlay);
    dumpBtn.classList.add("active");
    activeMode = "dump";
  }

  function hideDump() {
    if (dumpOverlay) { dumpOverlay.remove(); dumpOverlay = null; }
    if (dumpBtn) dumpBtn.classList.remove("active");
    activeMode = null;
  }

  if (hexBtn) hexBtn.addEventListener("click", function() {
    if (activeMode === "dump") hideDump();
    if (activeMode === "hex") { restore(); return; }
    apply("hex", 16, 4, hexBtn);
  });

  if (binBtn) binBtn.addEventListener("click", function() {
    if (activeMode === "dump") hideDump();
    if (activeMode === "bin") { restore(); return; }
    apply("bin", 2, 16, binBtn);
  });

  if (dumpBtn) {
    dumpBtn.addEventListener("click", function() {
      if (activeMode === "hex" || activeMode === "bin") restore();
      if (activeMode === "dump") { hideDump(); return; }
      showDump();
    });
    // Start in dump mode unless coming from language switch
    if (!new URLSearchParams(location.search).has("lang")) {
      showDump();
    }
  }
})();

// Auto-generate heading IDs and TOC
const toc = document.querySelector(".toc-sidebar .toc") || document.querySelector(".toc");
if (toc) {
  const headings = document.querySelectorAll(".post-content h2");
  const list = document.createElement("ul");
  headings.forEach((el, i) => {
    const id = "s" + i;
    el.id = id;
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#" + id;
    a.textContent = el.textContent;
    li.appendChild(a);
    list.appendChild(li);
  });
  // Replace manual TOC with auto-generated
  toc.innerHTML = "<strong>目次</strong>";
  toc.appendChild(list);

  // Highlight current section in TOC
  const tocLinks = list.querySelectorAll("a");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          tocLinks.forEach((a) => a.classList.remove("active"));
          const active = list.querySelector('a[href="#' + entry.target.id + '"]');
          if (active) active.classList.add("active");
        }
      });
    },
    { rootMargin: "0px 0px -80% 0px" }
  );
  headings.forEach((h) => observer.observe(h));
}
