const toggle = document.querySelector(".theme-toggle");
const stored = localStorage.getItem("theme");

if (stored) {
  document.documentElement.setAttribute("data-theme", stored);
} else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
  document.documentElement.setAttribute("data-theme", "dark");
}

function updateIcon() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  toggle.textContent = isDark ? "\u2600" : "\u263E";
}

toggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  updateIcon();
});

updateIcon();

// Auto-generate heading IDs and TOC
const toc = document.querySelector(".toc");
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
}
