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
  var navClose = document.getElementById("navClose");
  if (navClose) navClose.addEventListener("click", closeMenu);

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

  /* ---------- مركز التحميل: إعدادات البطاقة والتبويبات من اللوحة ---------- */
  function safeImg(v) {
    var s = String(v || "").trim();
    if (!s) return "";
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+\/=]+$/i.test(s)) return s;
    if (/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(s)) return s;
    return /^[a-zA-Z0-9_\-./]+$/.test(s) ? s : "";
  }

  function activateTab(name) {
    var tabs = $("#dlTabs");
    if (!tabs) return;
    var btn = tabs.querySelector('[data-tab="' + name + '"]');
    if (!btn || btn.hidden) return;
    $$("button", tabs).forEach(function (x) {
      var active = x === btn;
      x.classList.toggle("active", active);
      x.setAttribute("aria-selected", String(active));
    });
    var pro = name === "pro";
    var sec = $("#tools");
    if (sec) sec.classList.toggle("show-pro", pro);
    var pane = $("#proPane"), free = $("#freePane");
    if (pane) pane.hidden = !pro;
    if (free) free.hidden = pro;
  }

  function applyDownloadSettings(S) {
    S = S || (window.TWINS_DATA && window.TWINS_DATA.settings) || {};
    var feature = $("#dlFeature");
    if (feature) {
      var on = S.dl_feature_on === true;
      feature.hidden = !on;
      if (on) {
        var img = $("#dlFeatureImg");
        var src = safeImg(S.dl_feature_image);
        if (img) {
          img.hidden = !(S.dl_feature_show_image !== false && src);
          if (!img.hidden) {
            img.onerror = function () { img.hidden = true; };
            img.src = src;
          }
        }
        var link = $("#dlFeatureLink");
        var url = /^https?:\/\//i.test(String(S.dl_feature_url || "").trim()) ? String(S.dl_feature_url).trim() : "";
        if (link) {
          link.hidden = !(url && S.dl_feature_show_link !== false);
          if (url) link.href = url;
        }
        var copy = $("#dlFeatureCopy");
        var text = String(S.dl_feature_copy || "").trim();
        if (copy) {
          copy.hidden = !(text && S.dl_feature_show_copy !== false);
          copy.setAttribute("data-copy-text", text);
        }
      }
    }

    var tabs = $("#dlTabs");
    if (!tabs) return;
    var freeBtn = tabs.querySelector('[data-tab="free"]');
    var proBtn = tabs.querySelector('[data-tab="pro"]');
    if (freeBtn) freeBtn.hidden = S.dl_show_free === false;
    if (proBtn) proBtn.hidden = S.dl_show_pro === false;
    tabs.hidden = S.dl_show_free === false && S.dl_show_pro === false;
    if (tabs.hidden) {
      var pane = $("#proPane"), free = $("#freePane");
      if (pane) pane.hidden = true;
      if (free) free.hidden = false;
    } else if (freeBtn && freeBtn.hidden) activateTab("pro");
    else if (proBtn && proBtn.hidden) activateTab("free");
  }

  document.addEventListener("twins:settings", function (e) { applyDownloadSettings(e.detail); });
  applyDownloadSettings();

  /* ---------- زر نسخ البطاقة المميزة ---------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("#dlFeatureCopy");
    if (!btn) return;
    var text = btn.getAttribute("data-copy-text") || "";
    if (!text) return;
    var label = btn.querySelector("span");
    function setLabel(v) { if (label) label.textContent = v; else btn.textContent = v; }
    function done() {
      var old = btn.getAttribute("data-label") || (label ? label.textContent : "انسخ الرابط");
      btn.setAttribute("data-label", old);
      setLabel("تم النسخ ✓");
      btn.classList.add("copied");
      setTimeout(function () { setLabel(old); btn.classList.remove("copied"); }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text, btn, done); });
    else legacyCopy(text, btn, done);
  });

  function legacyCopy(text, btn, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { btn.textContent = "انسخ يدوياً"; }
    document.body.removeChild(ta);
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
