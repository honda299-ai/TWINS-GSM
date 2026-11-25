/* TWINS GSM — rendering, interactions & Firebase integration */
(function () {
  "use strict";

  var D = window.TWINS_DATA || {};
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var fb = { app: null, auth: null, db: null, analytics: null, ready: false };
  var revealObserver = null;
  var currentWorkFilter = "all";
  var currentToolFilter = "all";
  var toolQuery = "";
  var workBound = false;
  var toolsBound = false;

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  var icons = {
    bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    signal: '<path d="M4 20v-4M9 20v-8M14 20V8M19 20V4"/>',
    laptop: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 20h20"/>',
    shield: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'
  };

  function svg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || icons.bolt) + '</svg>';
  }

  function byOrder(a, b) {
    var ao = typeof a.order === "number" ? a.order : 999;
    var bo = typeof b.order === "number" ? b.order : 999;
    return ao - bo;
  }

  /* ================= Firebase ================= */

  function configLooksReal() {
    var c = window.TWINS_FIREBASE_CONFIG || {};
    var bad = /YOUR_|your-project|000000000000|XXXX|example/i;
    return !!(c.apiKey && c.projectId && c.appId && !bad.test(c.apiKey) && !bad.test(c.projectId) && !bad.test(c.appId));
  }

  function logEvent(name, params) {
    if (!fb.analytics) return;
    try { fb.analytics.logEvent(name, params || {}); } catch (e) { /* analytics غير متاح */ }
  }

  function initFirebase() {
    if (!window.firebase || !configLooksReal()) {
      console.info("TWINS GSM: Firebase غير مفعّل — الموقع هيشتغل بالبيانات المحلية في data.js.");
      return Promise.resolve(false);
    }

    try {
      var cfg = window.TWINS_FIREBASE_CONFIG;
      fb.app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
      fb.auth = firebase.auth();
      fb.db = firebase.firestore();

      fb.auth.onAuthStateChanged(function () {
        applyAuthGate();
        renderServices();
        paintTools();
        observeReveals();
      });

      if (cfg.measurementId && !/XXXX/i.test(cfg.measurementId)) {
        try { fb.analytics = firebase.analytics(); } catch (e) { /* تجاهل */ }
      }

      fb.ready = true;
      logEvent("page_view", { page_title: document.title });
      return loadFromFirestore();
    } catch (e) {
      console.warn("TWINS GSM: تعذر تهيئة Firebase —", e);
      return Promise.resolve(false);
    }
  }

  function loadFromFirestore() {
    if (!fb.ready || !fb.db) return Promise.resolve(false);

    var collections = ["stats", "services", "steps", "works", "workCategories", "tools", "toolCategories", "testimonials", "faqs"];

    var tasks = collections.map(function (name) {
      return fb.db.collection(name).get().then(function (snap) {
        var list = snap.docs.map(function (doc, i) {
          var data = doc.data() || {};
          data._id = doc.id;
          if (typeof data.order !== "number") data.order = i;
          return data;
        });
        if (list.length) D[name] = list.sort(byOrder);
      }).catch(function (e) {
        console.warn("TWINS GSM: لم يتم تحميل مجموعة " + name, e);
      });
    });

    var contactTask = fb.db.doc("site/contact").get().then(function (doc) {
      if (doc.exists) D.contact = Object.assign({}, D.contact, doc.data() || {});
    }).catch(function () { /* استخدم البيانات المحلية */ });

    return Promise.all(tasks.concat([contactTask])).then(function () {
      return resolveToolFiles();
    }).then(function () {
      renderAll();
      return true;
    });
  }

  function resolveToolFiles() {
    // الأدوات تُقدَّم من مجلد tools/ على Hosting أو من رابط خارجي مباشر.
    (D.tools || []).forEach(function (t) {
      var raw = t.file || t.storagePath || "#";
      if (/^gs:\/\//i.test(raw)) raw = "#"; // روابط Storage القديمة لم تعد مستخدمة
      t.file = raw || "#";
      delete t.storagePath;
    });
    return Promise.resolve();
  }

  /* ================= Auth gate ================= */

  function isLoggedIn() {
    return !!(fb.auth && fb.auth.currentUser);
  }

  function applyAuthGate() {
    var loggedIn = isLoggedIn();
    var gate = $("#toolsGate");
    var grid = $("#toolsGrid");
    var toolbar = $(".tools-toolbar");

    if (gate) gate.hidden = loggedIn;
    if (grid) grid.hidden = !loggedIn;
    if (toolbar) toolbar.hidden = !loggedIn;

    var accountBtn = $("#accountBtn");
    if (accountBtn) accountBtn.textContent = loggedIn ? "حسابي ✓" : "دخول";
  }

  /* ================= Contact ================= */

  function initContact() {
    var c = D.contact || {};
    var wa = c.whatsapp || "#";
    $$('#headerWhatsapp, #heroWhatsapp, #reviewWhatsapp, #faqWhatsapp, #contactWhatsapp').forEach(function (el) {
      el.href = wa;
      el.setAttribute("data-analytics", "whatsapp");
    });
    if ($("#contactPhone")) $("#contactPhone").textContent = c.phoneDisplay || "—";
    if ($("#contactEmail")) $("#contactEmail").textContent = c.email || "—";

    var socials = [
      { label: "واتساب", href: wa },
      { label: "فيسبوك", href: c.facebook || "#" },
      { label: "تيك توك", href: c.tiktok || "#" },
      { label: "إنستغرام", href: c.instagram || "#" }
    ];
    var row = $("#socialRow");
    if (row) row.innerHTML = socials.map(function (s) {
      return '<a href="' + esc(s.href) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a>';
    }).join("");
  }

  /* ================= Stats ================= */

  function renderStats() {
    var grid = $("#statsGrid");
    if (!grid) return;
    grid.innerHTML = (D.stats || []).map(function (s, i) {
      return '<div class="stat reveal" style="transition-delay:' + (i * 70) + 'ms"><b>' + esc(s.value) + '</b><span>' + esc(s.label) + '</span></div>';
    }).join("");
  }

  /* ================= Services ================= */

  function renderServices() {
    var grid = $("#servicesGrid");
    if (!grid) return;
    grid.innerHTML = (D.services || []).map(function (s, i) {
      return '<article class="card reveal" style="transition-delay:' + (i * 60) + 'ms">' +
        '<span class="card-number">0' + (i + 1) + '</span>' +
        '<div class="card-icon">' + svg(s.icon) + '</div>' +
        '<h3>' + esc(s.title) + '</h3>' +
        '<p>' + esc(s.desc) + '</p>' +
        (isLoggedIn() && s.price ? '<span class="price-chip">' + esc(s.price) + (s.priceNote ? ' <small>' + esc(s.priceNote) + '</small>' : '') + '</span>' : '') +
        '</article>';
    }).join("");
  }

  /* ================= Steps ================= */

  function renderSteps() {
    var grid = $("#stepsGrid");
    if (!grid) return;
    grid.innerHTML = (D.steps || []).map(function (s, i) {
      return '<article class="step reveal" style="transition-delay:' + (i * 80) + 'ms"><h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p></article>';
    }).join("");
  }

  /* ================= Work ================= */

  function paintWork() {
    var grid = $("#workGrid");
    if (!grid) return;
    var works = D.works || [];
    var list = currentWorkFilter === "all" ? works : works.filter(function (w) { return w.category === currentWorkFilter; });

    grid.innerHTML = list.map(function (w) {
      return '<article class="work-card reveal visible">' +
        '<span class="work-badge">✓ تم الإصلاح</span>' +
        '<div class="work-visual"><div class="work-device"></div></div>' +
        '<div class="work-body"><small>' + esc(w.brand) + '</small><h3>' + esc(w.model) + '</h3><p>' + esc(w.desc) + '</p></div>' +
        '</article>';
    }).join("");
  }

  function renderWork() {
    var filters = $("#workFilters");
    if (!filters) return;
    filters.innerHTML = (D.workCategories || []).map(function (c, i) {
      return '<button class="filter-chip' + (i === 0 ? ' active' : '') + '" data-filter="' + esc(c.id) + '" type="button">' + esc(c.label) + '</button>';
    }).join("");
    currentWorkFilter = "all";
    paintWork();

    if (!workBound) {
      filters.addEventListener("click", function (e) {
        var btn = e.target.closest(".filter-chip");
        if (!btn) return;
        $$(".filter-chip", filters).forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        currentWorkFilter = btn.getAttribute("data-filter");
        paintWork();
      });
      workBound = true;
    }
  }

  /* ================= Tools ================= */

  function paintTools() {
    var grid = $("#toolsGrid");
    var empty = $("#toolsEmpty");
    if (!grid) return;

    var list = (D.tools || []).filter(function (t) {
      var okCat = currentToolFilter === "all" || t.category === currentToolFilter;
      var text = (t.name + " " + t.desc + " " + (t.tag || "")).toLowerCase();
      return okCat && text.indexOf(toolQuery) !== -1;
    });

    grid.innerHTML = list.map(function (t) {
      var soon = !t.file || t.file === "#";
      return '<article class="tool-card reveal visible">' +
        '<div class="tool-top"><span class="tool-icon">' + svg("download") + '</span>' +
        '<span class="tool-tag' + (t.hot ? ' hot' : '') + '">' + esc(t.tag || "أداة") + '</span></div>' +
        '<h3>' + esc(t.name) + '</h3>' +
        '<p>' + esc(t.desc) + '</p>' +
        '<div class="tool-meta"><span>' + esc(t.version || "v1.0") + '</span><span>' + esc(t.size || "—") + '</span></div>' +
        '<a class="tool-download' + (soon ? ' disabled' : '') + '" href="' + (soon ? "#" : esc(t.file)) + '"' + (soon ? '' : ' download') + ' data-tool="' + esc(t.name) + '">' +
        svg("download") + '<span>' + (soon ? "قريباً" : "تحميل الأداة") + '</span></a>' +
        '</article>';
    }).join("");

    if (empty) empty.hidden = list.length !== 0;
  }

  function renderTools() {
    var filters = $("#toolFilters");
    var search = $("#toolsSearch");
    if (!filters || !search) return;

    filters.innerHTML = (D.toolCategories || []).map(function (c, i) {
      return '<button class="filter-chip' + (i === 0 ? ' active' : '') + '" data-filter="' + esc(c.id) + '" type="button">' + esc(c.label) + '</button>';
    }).join("");
    currentToolFilter = "all";
    toolQuery = "";
    search.value = "";
    paintTools();

    if (!toolsBound) {
      filters.addEventListener("click", function (e) {
        var btn = e.target.closest(".filter-chip");
        if (!btn) return;
        $$(".filter-chip", filters).forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        currentToolFilter = btn.getAttribute("data-filter");
        paintTools();
      });

      var timer = null;
      search.addEventListener("input", function () {
        toolQuery = search.value.trim().toLowerCase();
        paintTools();
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (toolQuery) logEvent("search", { search_term: toolQuery });
        }, 700);
      });
      toolsBound = true;
    }
  }

  /* ================= Reviews ================= */

  function renderReviews() {
    var grid = $("#reviewsGrid");
    if (!grid) return;
    grid.innerHTML = (D.testimonials || []).map(function (r, i) {
      return '<article class="review reveal" style="transition-delay:' + (i * 50) + 'ms">' +
        '<div class="stars" aria-label="5 نجوم">★★★★★</div>' +
        '<p>' + esc(r.text) + '</p>' +
        '<div class="review-author"><span>' + esc(String(r.name || "?").charAt(0)) + '</span>' +
        '<div><b>' + esc(r.name) + '</b><small>' + esc(r.role || "عميل") + '</small></div></div>' +
        '</article>';
    }).join("");
  }

  /* ================= FAQ ================= */

  function renderFaq() {
    var list = $("#faqList");
    if (!list) return;
    list.innerHTML = (D.faqs || []).map(function (f) {
      return '<div class="faq-item"><button class="faq-q" type="button" aria-expanded="false">' +
        '<span>' + esc(f.q) + '</span><span aria-hidden="true">+</span></button>' +
        '<div class="faq-a"><p>' + esc(f.a) + '</p></div></div>';
    }).join("");

    list.addEventListener("click", function (e) {
      var btn = e.target.closest(".faq-q");
      if (!btn) return;
      var item = btn.parentElement;
      var isOpen = item.classList.contains("open");
      $$(".faq-item", list).forEach(function (el) {
        el.classList.remove("open");
        $(".faq-q", el).setAttribute("aria-expanded", "false");
      });
      if (!isOpen) {
        item.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  }

  /* ================= Reveal ================= */

  function observeReveals() {
    var els = $$(".reveal:not(.visible)");
    if (!els.length) return;
    if (!revealObserver) {
      if ("IntersectionObserver" in window) {
        revealObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
              revealObserver.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12 });
      }
    }
    if (revealObserver) els.forEach(function (el) { revealObserver.observe(el); });
    else els.forEach(function (el) { el.classList.add("visible"); });
  }

  /* ================= UI ================= */

  function initUi() {
    var toggle = $("#menuToggle");
    var nav = $("#mainNav");
    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        var open = document.body.classList.toggle("menu-open");
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "إغلاق القائمة" : "فتح القائمة");
      });
      nav.addEventListener("click", function (e) {
        if (e.target.closest("a")) {
          document.body.classList.remove("menu-open");
          toggle.setAttribute("aria-expanded", "false");
        }
      });
    }

    document.addEventListener("click", function (e) {
      var dl = e.target.closest(".tool-download");
      if (dl && !dl.classList.contains("disabled")) {
        logEvent("download", { item_name: dl.getAttribute("data-tool") || "tool" });
      }
      if (e.target.closest("[data-analytics='whatsapp']")) {
        logEvent("contact_whatsapp", { source: "site" });
      }
    });

    var year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
  }

  /* ================= Boot ================= */

  function renderAll() {
    initContact();
    renderStats();
    renderServices();
    renderSteps();
    renderWork();
    renderTools();
    renderReviews();
    renderFaq();
    observeReveals();
  }

  applyAuthGate();
  renderAll();
  initUi();
  initFirebase();

  // للاستخدام لاحقاً لو حابب تحدّث البيانات يدوياً من الكونسول/لوحة أدمن
  window.TWINS_APP = { refresh: renderAll, data: D, firebase: fb };
})();
