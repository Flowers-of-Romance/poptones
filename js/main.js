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
  span.textContent = minutes + " min read";
  postMeta.appendChild(span);
}

// Action sidebar buttons
const likeBtn = document.querySelector(".like-btn");
const bookmarkBtn = document.querySelector(".bookmark-btn");
const facebookBtn = document.querySelector(".facebook-btn");
const hatenaBtn = document.querySelector(".hatena-btn");

function showToast(msg) {
  const existing = document.querySelector(".action-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "action-toast";
  toast.textContent = msg;
  toast.style.cssText =
    "position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);" +
    "background:var(--card-bg);color:var(--text);border:1px solid var(--card-border);" +
    "padding:0.6rem 1.2rem;border-radius:8px;font-size:0.9rem;z-index:999;" +
    "animation:fadeout 2s forwards";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

if (!document.querySelector("#toast-style")) {
  const style = document.createElement("style");
  style.id = "toast-style";
  style.textContent = "@keyframes fadeout{0%,70%{opacity:1}100%{opacity:0}}";
  document.head.appendChild(style);
}

if (likeBtn) {
  likeBtn.addEventListener("click", () => showToast("そんな機能はないよ"));
}
if (bookmarkBtn) {
  bookmarkBtn.addEventListener("click", () => showToast("そんな機能はないよ"));
}
if (facebookBtn) {
  facebookBtn.addEventListener("click", () => showToast("Facebookはちょっと"));
}
if (hatenaBtn) {
  const url = encodeURIComponent(location.href);
  const title = encodeURIComponent(document.title);
  hatenaBtn.href = "https://b.hatena.ne.jp/entry/panel/?url=" + url + "&title=" + title;
}

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
