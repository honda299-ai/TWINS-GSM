/* TWINS GSM — تحسينات الواجهة: شاشة تحميل، تنقل سفلي، وتغذية راجعة للتحميل */
(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  /* ---------- شاشة التحميل ---------- */
  function hideLoader() {
    var loader = $("#pageLoader");
    if (loader) loader.classList.add("done");
  }
  if (document.readyState === "complete") setTimeout(hideLoader, 200);
  else window.addEventListener("load", function () { setTimeout(hideLoader, 220); });
  // احتياطي لو تأخرت المصادر الخارجية (الخطوط / Firebase)
  setTimeout(hideLoader, 2200);

  /* ---------- إغلاق قائمة الموبايل بسهولة ---------- */
  function closeMenu() {
    document.body.classList.remove("menu-open");
    var toggle = $("#menuToggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "فتح القائمة");
    }
  }
  document.addEventListener("click", function (e) {
    if (!document.body.classList.contains("menu-open")) return;
    if (e.target.closest("#menuToggle")) return; // الزر نفسه بيتولّى فتح/إغلاق
    if (e.target.closest("#mainNav a")) { closeMenu(); return; }
    if (!e.target.closest(".site-header")) closeMenu();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });

  /* ---------- شريط التنقل السفلي ---------- */
  var dock = $("#mobileDock");
  if (dock) {
    var links = $$("a[data-dock]", dock);

    function setActive(id) {
      links.forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("data-dock") === id);
      });
    }

    links.forEach(function (a) {
      a.addEventListener("click", function () {
        var id = a.getAttribute("data-dock");
        if (id !== "account") setActive(id);
      });
    });

    if ("IntersectionObserver" in window) {
      var ids = ["top", "services", "tools"];
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      }, { rootMargin: "-35% 0px -55% 0px" });
      ids.forEach(function (id) {
        var section = document.getElementById(id);
        if (section) io.observe(section);
      });
    }
  }

  /* ---------- زر التحميل: حالة واضحة بعد الضغط ---------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".tool-download");
    if (!btn || btn.classList.contains("disabled") || btn.classList.contains("is-loading")) return;

    var label = btn.querySelector("span");
    var original = label ? label.textContent : "";
    btn.classList.add("is-loading");
    if (label) label.textContent = "جاري التحميل...";

    setTimeout(function () {
      btn.classList.remove("is-loading");
      btn.classList.add("is-done");
      if (label) label.textContent = "بدأ التحميل ✓";
      setTimeout(function () {
        btn.classList.remove("is-done");
        if (label) label.textContent = original;
      }, 1400);
    }, 800);
  });
})();
