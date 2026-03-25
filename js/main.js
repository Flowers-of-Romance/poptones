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
