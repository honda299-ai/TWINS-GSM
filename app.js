/* TWINS GSM — Main Application */
(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var db = null;
  var currentCategory = "all";
  var searchQuery = "";
  var allTools = [];
  var allWorks = [];

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function safeHref(url) {
    var raw = String(url == null ? "" : url).trim();
    if (!raw) return "#";
    if (/^(https?:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(raw)) return raw;
    if (/^[a-zA-Z0-9_\-./]+$/.test(raw)) return raw;
    return "#";
  }

  function initFirebase() {
    if (window.firebase && window.TWINS_FIREBASE_CONFIG) {
      try {
        if (!firebase.apps.length) firebase.initializeApp(window.TWINS_FIREBASE_CONFIG);
        db = firebase.firestore();
      } catch (e) {
        console.warn("Firebase init failed, using static data.", e);
      }
    }
  }

  function loadData() {
    initFirebase();
    if (!db) {
      renderStaticData();
      return;
    }

    // Services
    db.collection("services").orderBy("order").get().then(function (snap) {
      if (snap.empty) return;
      var html = snap.docs.map(function (d) {
        var s = d.data();
        return '<div class="service-card"><div class="service-icon" aria-hidden="true"><img src="favicon.svg" alt="" style="width:24px;opacity:0.8;filter:invert(1)"></div>' +
          '<div><h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p></div></div>';
      }).join("");
      var grid = $("#servicesGrid");
      if (grid) grid.innerHTML = html;
    }).catch(renderStaticData);

    // Works
    db.collection("works").orderBy("order").get().then(function (snap) {
      if (!snap.empty) {
        allWorks = snap.docs.map(function (d) { return d.data(); });
        renderWorks();
      }
    });

    // Tools
    db.collection("tools").orderBy("order").get().then(function (snap) {
      if (!snap.empty) {
        allTools = snap.docs.map(function (d) { return d.data(); });
        renderTools();
      }
    });

    // Testimonials
    db.collection("testimonials").orderBy("order").get().then(function (snap) {
      if (snap.empty) return;
      var html = snap.docs.map(function (d) {
        var t = d.data();
        return '<div class="review-card"><div class="review-stars" aria-hidden="true">★★★★★</div>' +
          '<p class="review-text">"' + esc(t.text) + '"</p><div class="review-author"><b>' + esc(t.name) + '</b><small>' + esc(t.role || "") + '</small></div></div>';
      }).join("");
      var grid = $("#reviewsGrid");
      if (grid) grid.innerHTML = html;
    });

    // FAQs
    db.collection("faqs").orderBy("order").get().then(function (snap) {
      if (snap.empty) return;
      var html = snap.docs.map(function (d) {
        var f = d.data();
        return '<details class="faq-item"><summary class="faq-q">' + esc(f.q) + '</summary><div class="faq-a"><p>' + esc(f.a) + '</p></div></details>';
      }).join("");
      var list = $("#faqList");
      if (list) list.innerHTML = html;
    });

    // Stats
    db.collection("stats").orderBy("order").get().then(function (snap) {
      if (snap.empty) return;
      var html = snap.docs.map(function (d) {
        var s = d.data();
        return '<div class="stat-card"><b>' + esc(s.value) + '</b><span>' + esc(s.label) + '</span></div>';
      }).join("");
      var grid = $("#statsGrid");
      if (grid) grid.innerHTML = html;
    });

    // Contact
    db.doc("site/contact").get().then(function (doc) {
      if (doc.exists) {
        var c = doc.data();
        if (c.phoneDisplay) $("#contactPhone").textContent = c.phoneDisplay;
        if (c.email) $("#contactEmail").textContent = c.email;
        if (c.whatsapp) {
          var wa = safeHref(c.whatsapp);
          $("#headerWhatsapp").href = wa;
          $("#heroWhatsapp").href = wa;
          $("#contactWhatsapp").href = wa;
          $("#faqWhatsapp").href = wa;
          $("#reviewWhatsapp").href = wa;
          var phoneAppAction = $("#phoneAppAction");
          if(phoneAppAction) phoneAppAction.href = wa;
        }
      }
    });
  }

  function renderStaticData() {
    console.log("Using static data as fallback");
    if (!window.TWINS_DATA) return;
    var d = window.TWINS_DATA;

    if (d.services && $("#servicesGrid")) {
        $("#servicesGrid").innerHTML = d.services.map(function (s) {
            return '<div class="service-card"><div class="service-icon" aria-hidden="true"><img src="favicon.svg" alt="" style="width:24px;opacity:0.8;filter:invert(1)"></div>' +
              '<div><h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p></div></div>';
        }).join("");
    }
    if (d.works) { allWorks = d.works; renderWorks(); }
    if (d.tools) { allTools = d.tools; renderTools(); }
  }


  function renderWorks() {
    var grid = $("#workGrid");
    if (!grid) return;
    var html = allWorks.map(function (w) {
      var imgHtml = w.image && w.image !== "#" ? '<div class="work-img"><img src="' + esc(w.image) + '" alt="' + esc(w.model) + '" style="object-fit:cover;width:100%;height:100%"></div>' : '<div class="work-img placeholder">صورة غير متوفرة</div>';
      return '<div class="work-card">' + imgHtml + '<div class="work-info"><h3>' + esc(w.brand) + ' ' + esc(w.model) + '</h3>' +
        (w.desc ? '<p>' + esc(w.desc) + '</p>' : '') + '</div></div>';
    }).join("");
    grid.innerHTML = html;
  }

  function renderTools() {
    var grid = $("#toolsGrid");
    if (!grid) return;
    var filtered = allTools.filter(function (t) {
        var matchCat = currentCategory === "all" || t.category === currentCategory;
        var matchSearch = t.name.toLowerCase().indexOf(searchQuery) !== -1 || (t.desc && t.desc.toLowerCase().indexOf(searchQuery) !== -1);
        return matchCat && matchSearch;
    });

    var emptyMsg = $("#toolsEmpty");
    if(emptyMsg) emptyMsg.hidden = filtered.length > 0;

    var html = filtered.map(function (t) {
      var link = t.file && t.file !== "#" ? '<a href="' + esc(t.file) + '" class="btn btn-outline btn-sm" target="_blank">تحميل ⬇</a>' : '<span class="status">قريباً</span>';
      return '<div class="tool-card"><div class="tool-head"><h3>' + esc(t.name) + '</h3>' +
        (t.tag ? '<span class="status">' + esc(t.tag) + '</span>' : '') + '</div>' +
        '<p class="tool-meta">' + esc(t.version) + ' · ' + esc(t.size) + '</p>' +
        (t.desc ? '<p class="tool-desc">' + esc(t.desc) + '</p>' : '') +
        '<div class="tool-foot">' + link + '</div></div>';
    }).join("");
    grid.innerHTML = html;
  }

  function bindEvents() {
      var menuToggle = $("#menuToggle");
      var mainNav = $("#mainNav");
      if (menuToggle && mainNav) {
          menuToggle.addEventListener("click", function () {
              var expanded = this.getAttribute("aria-expanded") === "true";
              this.setAttribute("aria-expanded", !expanded);
              mainNav.classList.toggle("open");
          });
      }

      $$('a[href^="#"]').forEach(function (anchor) {
          anchor.addEventListener("click", function (e) {
              var targetId = this.getAttribute("href");
              if (targetId === "#") return;
              var target = $(targetId);
              if (target) {
                  e.preventDefault();
                  target.scrollIntoView({ behavior: "smooth" });
                  if (mainNav && mainNav.classList.contains("open")) {
                      menuToggle.click();
                  }
              }
          });
      });

      var searchInput = $("#toolsSearch");
      if (searchInput) {
          searchInput.addEventListener("input", function (e) {
              searchQuery = e.target.value.toLowerCase().trim();
              renderTools();
          });
      }

      var phoneAppView = $("#phoneAppView");
      var phoneBack = $("#phoneBack");
      if(phoneBack) {
          phoneBack.addEventListener("click", function() {
              phoneAppView.hidden = true;
          });
      }

      $$(".phone-app, .dock-btn").forEach(function(btn) {
         btn.addEventListener("click", function() {
             var appName = this.getAttribute("data-app");
             var title = $("#phoneAppTitle");
             var body = $("#phoneAppBody");
             var action = $("#phoneAppAction");

             if(!title || !body || !action) return;

             var configs = {
                 whatsapp: { t: "واتساب", b: "تواصل معنا مباشرة عبر واتساب للرد السريع وتحديد التكلفة.", btn: "فتح المحادثة" },
                 phone: { t: "اتصال", b: "اتصل بنا هاتفياً للاستفسارات العاجلة.", btn: "اتصل الآن" },
                 messages: { t: "الرسائل", b: "أرسل رسالة نصية قصيرة.", btn: "إرسال رسالة" },
                 instagram: { t: "إنستغرام", b: "تابع أحدث أعمالنا على إنستغرام.", btn: "فتح إنستغرام" },
                 facebook: { t: "فيسبوك", b: "تواصل معنا عبر صفحة فيسبوك.", btn: "فتح فيسبوك" },
                 tiktok: { t: "تيك توك", b: "شاهد فيديوهات الصيانة على تيك توك.", btn: "فتح تيك توك" },
                 tools: { t: "أدواتنا", b: "تصفح وحمل أحدث أدوات السوفت وير.", btn: "عرض الأدوات" }
             };

             var cfg = configs[appName] || {t: appName, b: "تفاصيل التطبيق.", btn: "فتح"};
             title.textContent = cfg.t;
             body.textContent = cfg.b;
             action.textContent = cfg.btn;
             phoneAppView.hidden = false;
         });
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadData();
    bindEvents();
    var yearEl = $("#year");
    if(yearEl) yearEl.textContent = new Date().getFullYear();
  });

})();
