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
  var faqBound = false;

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function safeHref(url, fallback) {
    var raw = String(url == null ? "" : url).trim();
    if (!raw) return fallback || "#";
    if (/^(https?:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(raw)) return raw;
    if (/^[a-zA-Z0-9_\-./]+$/.test(raw)) return raw; // relative local paths like tools/file.zip
    return fallback || "#";
  }

  // صور مسموحة: رابط http(s) / مسار محلي / صورة مرفوعة من الأدمن (data URL مضغوطة)
  function safeImg(url) {
    var raw = String(url == null ? "" : url).trim();
    if (!raw) return "";
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+\/=]+$/i.test(raw)) return raw;
    if (/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(raw)) return raw;
    if (/^[a-zA-Z0-9_\-./]+$/.test(raw)) return raw;
    return "";
  }

  /* ================= Site settings (من لوحة التحكم) ================= */

  var SETTINGS_CACHE_KEY = "twins_settings_v1";

  function readSettingsCache() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_CACHE_KEY) || "null"); } catch (e) { return null; }
  }
  function writeSettingsCache(v) {
    try { localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(v)); } catch (e) { /* الكاش اختياري */ }
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, Math.max(0, (n >> 16) + amt));
    var g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amt));
    var b = Math.min(255, Math.max(0, (n & 255) + amt));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function applySettings(S) {
    if (!S || typeof S !== "object") return;
    D.settings = S;
    var root = document.documentElement;

    // النصوص
    var view = Object.assign({}, S);
    if (S.brand_first || S.brand_second) view.brand_full = ((S.brand_first || "TWINS") + " " + (S.brand_second || "GSM")).trim();
    $$("[data-cms]").forEach(function (el) {
      var v = view[el.getAttribute("data-cms")];
      if (typeof v === "string" && v.trim() !== "") el.textContent = v;
    });

    // اللون الأساسي
    if (/^#[0-9a-f]{6}$/i.test(S.color_primary || "")) {
      var n = parseInt(S.color_primary.slice(1), 16);
      root.style.setProperty("--orange", S.color_primary);
      root.style.setProperty("--orange-2", shade(S.color_primary, 28));
      root.style.setProperty("--orange-dark", shade(S.color_primary, -45));
      root.style.setProperty("--orange-rgb", (n >> 16) + ", " + ((n >> 8) & 255) + ", " + (n & 255));
      root.style.setProperty("--orange-soft", "rgba(" + (n >> 16) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ", 0.14)");
    }

    // الشعار والأيقونة
    var logo = safeImg(S.logo);
    if (logo) {
      $$(".brand-mark, .phone-brand-mark").forEach(function (el) {
        el.classList.add("has-logo");
        el.innerHTML = '<img src="' + esc(logo) + '" alt="" />';
      });
    }
    var fav = safeImg(S.favicon || S.logo);
    var favLink = $('link[rel="icon"]');
    if (fav && favLink) { favLink.removeAttribute("type"); favLink.href = fav; }

    // صورة الهيرو بدل الموبايل التفاعلي
    var heroImg = safeImg(S.hero_image);
    var hv = $("#heroVisual");
    var useImg = S.hero_visual === "image" && heroImg;
    if (hv && $("#heroImage")) {
      $("#heroImage").hidden = !useImg;
      hv.classList.toggle("has-image", !!useImg);
      if (useImg) $("#heroImageEl").src = heroImg;
    }

    // إظهار/إخفاء الأقسام (وروابطها في القائمة)
    $$("[data-section]").forEach(function (sec) {
      var key = sec.getAttribute("data-section");
      var hidden = S["show_" + key] === false;
      sec.hidden = hidden;
      var link = $('.main-nav a[href="#' + key + '"]');
      if (link) link.hidden = hidden;
    });

    // زر واتساب العائم
    var fw = $("#floatWa");
    if (fw) fw.hidden = S.float_wa_on === false || fw.getAttribute("href") === "#";

    // شريط الإعلان
    var bar = $("#announceBar");
    if (bar) {
      var text = String(S.announce_text || "").trim();
      var dismissed = false;
      try { dismissed = sessionStorage.getItem("twins_announce") === text; } catch (e) { /* تجاهل */ }
      bar.hidden = !(S.announce_on === true && text && !dismissed);
      var al = $("#announceLink");
      if (al) al.href = safeHref(S.announce_link, "#");
      if (al && S.announce_link) { al.target = "_blank"; al.rel = "noopener noreferrer"; }
    }

    // SEO
    if (S.seo_title) {
      document.title = S.seo_title;
      var ogt = $('meta[property="og:title"]'); if (ogt) ogt.setAttribute("content", S.seo_title);
    }
    if (S.seo_description) {
      var md = $('meta[name="description"]'); if (md) md.setAttribute("content", S.seo_description);
      var ogd = $('meta[property="og:description"]'); if (ogd) ogd.setAttribute("content", S.seo_description);
    }
    var ogi = $("#ogImage");
    var seoImg = safeImg(S.seo_image);
    if (ogi && seoImg && seoImg.indexOf("data:") !== 0) ogi.setAttribute("content", seoImg);

    // إشارة للطبقات الإضافية (مركز التحميل) عشان تطبّق إعداداتها فور وصولها من اللوحة.
    document.dispatchEvent(new CustomEvent("twins:settings", { detail: S }));
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
        list = list.filter(function (x) { return x.active !== false; });
        if ((name === "workCategories" || name === "toolCategories") && !list.some(function (c) { return c.id === "all"; })) {
          list.unshift({ id: "all", label: name === "workCategories" ? "كل الأعمال" : "كل الأدوات", order: -1 });
        }
        if (snap.size) D[name] = list.sort(byOrder);
      }).catch(function (e) {
        console.warn("TWINS GSM: لم يتم تحميل مجموعة " + name, e);
      });
    });

    var contactTask = fb.db.doc("site/contact").get().then(function (doc) {
      if (doc.exists) D.contact = Object.assign({}, D.contact, doc.data() || {});
    }).catch(function () { /* استخدم البيانات المحلية */ });

    var settingsTask = fb.db.doc("site/settings").get().then(function (doc) {
      if (doc.exists) {
        var st = doc.data() || {};
        writeSettingsCache(st);
        D.settings = st;
      }
    }).catch(function () { /* استخدم الكاش أو الافتراضي */ });

    return Promise.all(tasks.concat([contactTask, settingsTask])).then(function () {
      return resolveToolFiles();
    }).then(function () {
      renderAll();
      applySettings(D.settings);
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
    $$('#headerWhatsapp, #heroWhatsapp, #reviewWhatsapp, #faqWhatsapp, #contactWhatsapp, #floatWa').forEach(function (el) {
      el.href = safeHref(wa);
      el.setAttribute("data-analytics", "whatsapp");
      el.rel = "noopener noreferrer";
    });
    var fw0 = $("#floatWa");
    if (fw0) fw0.hidden = safeHref(wa) === "#" || (D.settings && D.settings.float_wa_on === false);
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
      return '<a href="' + esc(safeHref(s.href)) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + '</a>';
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
        (s.image && safeImg(s.image) ? '<img class="card-img" src="' + esc(safeImg(s.image)) + '" alt="" loading="lazy" />' : '') +
        
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
      var img = safeImg(w.image);
      var visual = img ?
        '<div class="work-visual has-image"><img src="' + esc(img) + '" alt="' + esc((w.brand || "") + " " + (w.model || "")) + '" loading="lazy" onerror="this.parentElement.classList.remove(\'has-image\');this.remove();this.parentElement.innerHTML=\'<div class=\\\'work-device\\\'></div>\'"></div>' :
        '<div class="work-visual"><div class="work-device"></div></div>';
      return '<article class="work-card reveal visible' + (img ? ' has-photo' : '') + '"' + (img ? ' tabindex="0" role="button" aria-label="عرض صورة ' + esc(w.model || "") + '"' : '') + '>' +
        '<span class="work-badge">✓ تم الإصلاح</span>' +
        visual +
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
      var text = [t.name, t.desc, t.tag].join(" ").toLowerCase();
      return okCat && text.indexOf(toolQuery) !== -1;
    });

    grid.innerHTML = list.map(function (t) {
      var file = safeHref(t.file, "#");
      var soon = !file || file === "#";
      return '<article class="tool-card reveal visible">' +
        (t.image && safeImg(t.image) ? '<img class="card-img" src="' + esc(safeImg(t.image)) + '" alt="" loading="lazy" />' : '') +
        '<div class="tool-top"><span class="tool-icon">' + svg("download") + '</span>' +
        '<span class="tool-tag' + (t.hot ? ' hot' : '') + '">' + esc(t.tag || "أداة") + '</span></div>' +
        '<h3>' + esc(t.name) + '</h3>' +
        '<p>' + esc(t.desc) + '</p>' +
        '<div class="tool-meta"><span>' + esc(t.version || "v1.0") + '</span><span>' + esc(t.size || "—") + '</span></div>' +
        '<a class="tool-download' + (soon ? ' disabled' : '') + '" href="' + esc(soon ? "#" : file) + '"' + (soon ? ' aria-disabled="true" tabindex="-1"' : ' download rel="noopener noreferrer"') + ' data-tool="' + esc(t.name) + '">' +
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

  function stars(n) {
    n = Math.round(Number(n));
    return n >= 1 && n <= 5 ? n : 5;
  }

  function renderReviews() {
    var grid = $("#reviewsGrid");
    if (!grid) return;
    grid.innerHTML = (D.testimonials || []).map(function (r, i) {
      return '<article class="review reveal" style="transition-delay:' + (i * 50) + 'ms">' +
        '<div class="stars" aria-label="' + stars(r.rating) + ' نجوم">' + "★★★★★".slice(0, stars(r.rating)) + '<i>' + "★★★★★".slice(0, 5 - stars(r.rating)) + '</i></div>' +
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

    if (faqBound) return;
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
    faqBound = true;
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

    initInteractivePhone();
    initScrollSpy();
    initLightbox();
    var ac = $("#announceClose");
    if (ac) ac.addEventListener("click", function () {
      $("#announceBar").hidden = true;
      try { sessionStorage.setItem("twins_announce", String((D.settings && D.settings.announce_text) || "").trim()); } catch (e) { /* تجاهل */ }
    });
    var year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
  }

  function initScrollSpy() {
    var header = $("#siteHeader");
    function onScroll() { if (header) header.classList.toggle("scrolled", window.scrollY > 12); }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (!("IntersectionObserver" in window)) return;
    var links = $$('.main-nav a[href^="#"]');
    var map = {};
    links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (l) { l.classList.remove("active"); });
        if (map[e.target.id]) map[e.target.id].classList.add("active");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(map).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) io.observe(sec);
    });
  }

  function initLightbox() {
    var box = $("#lightbox");
    var grid = $("#workGrid");
    if (!box || !grid) return;
    var img = $("#lightboxImg");
    var cap = $("#lightboxCap");

    function open(card) {
      var src = card.querySelector("img");
      if (!src) return;
      img.src = src.src;
      cap.textContent = ((card.querySelector("small") || {}).textContent || "") + " — " + ((card.querySelector("h3") || {}).textContent || "");
      box.hidden = false;
      document.body.style.overflow = "hidden";
    }
    function close() {
      box.hidden = true;
      img.removeAttribute("src");
      document.body.style.overflow = "";
    }
    grid.addEventListener("click", function (e) {
      var card = e.target.closest(".work-card.has-photo");
      if (card) open(card);
    });
    grid.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var card = e.target.closest(".work-card.has-photo");
      if (card) { e.preventDefault(); open(card); }
    });
    box.addEventListener("click", function (e) { if (e.target === box || e.target.id === "lightboxClose") close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !box.hidden) close(); });
  }

  function initInteractivePhone() {
    var phone = $("#interactivePhone");
    if (!phone || phone.dataset.bound === "1") return;
    phone.dataset.bound = "1";

    var home = $("#phoneHome");
    var view = $("#phoneAppView");
    var body = $("#phoneAppBody");
    var title = $("#phoneAppTitle");
    var sub = $("#phoneAppSub");
    var action = $("#phoneAppAction");
    var back = $("#phoneBack");
    var clock = $("#phoneClock");

    function updateClock() {
      if (!clock) return;
      var d = new Date();
      var h = String(d.getHours()).padStart(2, "0");
      var m = String(d.getMinutes()).padStart(2, "0");
      clock.textContent = h + ":" + m;
    }
    updateClock();
    setInterval(updateClock, 30000);

    function c() { return D.contact || {}; }
    function telHref() {
      var raw = String(c().phoneDisplay || c().whatsapp || "").replace(/[^\d+]/g, "");
      return raw ? "tel:" + raw : "#";
    }
    function waMsg(text) {
      var base = String(c().whatsapp || "").trim();
      if (!base || base === "#") return "#";
      var join = base.indexOf("?") > -1 ? "&" : "?";
      return base + join + "text=" + encodeURIComponent(text || "السلام عليكم، محتاج مساعدة من TWINS GSM");
    }

    var apps = {
      phone: function () {
        return {
          title: "الهاتف", sub: c().phoneDisplay || "اتصل بنا",
          body: '<div class="phone-chat"><div class="phone-bubble in">أهلاً بك في <strong>TWINS GSM</strong> 👋<br>اضغط للاتصال المباشر وسنساعدك في مشكلة جهازك.</div><div class="phone-bubble out">عايز استفسار بخصوص صيانة سوفت وير.</div></div>',
          action: telHref(), actionLabel: "اتصال الآن", disabled: telHref() === "#"
        };
      },
      whatsapp: function () {
        var href = waMsg("السلام عليكم، عندي جهاز محتاج صيانة سوفت وير من TWINS GSM");
        return {
          title: "واتساب", sub: "رد سريع",
          body: '<div class="phone-chat"><div class="phone-bubble in">مرحبًا! معاك <strong>TWINS GSM</strong>.<br>ابعت نوع الجهاز والمشكلة وهنرد عليك.</div><div class="phone-bubble out">السلام عليكم، عندي مشكلة في جهازي ومحتاج مساعدة.</div></div>',
          action: href, actionLabel: "فتح واتساب", disabled: href === "#"
        };
      },
      messages: function () {
        var raw = String(c().phoneDisplay || "").replace(/[^\d+]/g, "");
        var href = raw ? "sms:" + raw + "?body=" + encodeURIComponent("السلام عليكم TWINS GSM، محتاج استفسار بخصوص جهاز") : "#";
        return {
          title: "الرسائل", sub: "SMS",
          body: '<div class="phone-chat"><div class="phone-bubble in">تقدر تبعتلنا رسالة SMS بتفاصيل الجهاز والعطل.</div><div class="phone-bubble out">السلام عليكم، محتاج استفسار بخصوص جهازي.</div></div>',
          action: href, actionLabel: "إرسال رسالة", disabled: href === "#"
        };
      },
      instagram: function () {
        var href = safeHref(c().instagram, "#");
        return {
          title: "إنستغرام", sub: "@twinsgsm",
          body: '<div class="phone-chat"><div class="phone-bubble in">تابع شغلنا وآخر الحالات على إنستغرام.</div><div class="phone-bubble out">عايز أشوف شغلكم الأخير.</div></div>',
          action: href, actionLabel: "فتح إنستغرام", disabled: href === "#"
        };
      },
      facebook: function () {
        var href = safeHref(c().facebook, "#");
        return {
          title: "فيسبوك", sub: "TWINS GSM",
          body: '<div class="phone-chat"><div class="phone-bubble in">تابع صفحتنا على فيسبوك للعروض وآخر الأعمال.</div><div class="phone-bubble out">عايز أتابع الصفحة.</div></div>',
          action: href, actionLabel: "فتح فيسبوك", disabled: href === "#"
        };
      },
      tiktok: function () {
        var href = safeHref(c().tiktok, "#");
        return {
          title: "تيك توك", sub: "فيديوهات سريعة",
          body: '<div class="phone-chat"><div class="phone-bubble in">شوف فيديوهات الإصلاحات والنصائح على تيك توك.</div><div class="phone-bubble out">عايز أشوف الفيديوهات.</div></div>',
          action: href, actionLabel: "فتح تيك توك", disabled: href === "#"
        };
      },
      tools: function () {
        return {
          title: "أدوات TWINS", sub: "قسم الأدوات",
          body: '<div class="phone-chat"><div class="phone-bubble in">استعرض أدوات TWINS GSM الجاهزة للتحميل.</div><div class="phone-bubble out">عايز أشوف الأدوات المتاحة.</div></div>',
          action: "#tools", actionLabel: "الذهاب للأدوات", disabled: false, internal: true
        };
      }
    };

    function openApp(name) {
      var fn = apps[name];
      if (!fn) return;
      var cfg = fn();
      title.textContent = cfg.title;
      sub.textContent = cfg.sub || "TWINS GSM";
      body.innerHTML = cfg.body;
      action.textContent = cfg.actionLabel || "فتح";
      action.href = safeHref(cfg.action, "#");
      action.classList.toggle("disabled", !!cfg.disabled);
      if (cfg.internal) {
        action.removeAttribute("target");
        action.rel = "";
      } else {
        action.target = "_blank";
        action.rel = "noopener noreferrer";
      }
      if (cfg.disabled) action.setAttribute("aria-disabled", "true"); else action.removeAttribute("aria-disabled");
      home.hidden = true;
      view.hidden = false;
      logEvent("phone_app_open", { app: name });
    }

    function closeApp() {
      view.hidden = true;
      home.hidden = false;
    }

    phone.addEventListener("click", function (e) {
      var appBtn = e.target.closest("[data-app]");
      if (appBtn) { openApp(appBtn.getAttribute("data-app")); return; }
      if (e.target.closest("#phoneBack")) closeApp();
    });
    if (action) action.addEventListener("click", function (e) {
      if (action.classList.contains("disabled")) e.preventDefault();
    });
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
  applySettings(readSettingsCache());
  initUi();
  initFirebase();

  // للاستخدام لاحقاً لو حابب تحدّث البيانات يدوياً من الكونسول/لوحة أدمن
  window.TWINS_APP = { refresh: renderAll, data: D, firebase: fb };
})();
