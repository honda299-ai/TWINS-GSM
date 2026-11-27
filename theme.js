/* TWINS GSM — وضع فاتح/داكن (بيفتكر اختيارك ويتبع إعداد جهازك أول مرة) */
(function () {
  "use strict";
  var K = "twins-theme", root = document.documentElement, saved = null;
  try { saved = localStorage.getItem(K); } catch (e) {}
  var cur = saved || (window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  root.setAttribute("data-theme", cur);
  document.addEventListener("DOMContentLoaded", function () {
    var b = document.createElement("button"); b.type = "button"; b.className = "theme-btn"; b.setAttribute("aria-label", "تبديل الوضع الفاتح/الداكن");
    function paint() { b.textContent = root.getAttribute("data-theme") === "light" ? "🌙" : "☀️"; }
    b.onclick = function () { var n = root.getAttribute("data-theme") === "light" ? "dark" : "light"; root.setAttribute("data-theme", n); try { localStorage.setItem(K, n); } catch (e) {} paint(); };
    paint();
    var slot = document.querySelector(".site-header .header-account");
    if (slot) slot.parentNode.insertBefore(b, slot); else { b.classList.add("floating"); document.body.appendChild(b); }
  });
})();
