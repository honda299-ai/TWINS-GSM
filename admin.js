/* TWINS GSM — Admin core: auth, router, modal, image compression, seeding */
window.ADM = (function () {
  "use strict";

  var A = { views: {}, db: null, auth: null, user: null, isPrimary: false, current: "overview" };
  A.PRIMARY = "hondastore299@gmail.com";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  A.$ = $; A.$$ = $$;

  A.esc = function (v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  };
  var esc = A.esc;

  A.fmt = function (ts) {
    if (!ts) return "—";
    try { return (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }); }
    catch (e) { return "—"; }
  };

  var toastTimer;
  A.toast = function (msg, isError) {
    var el = $("#toast");
    el.textContent = msg;
    el.className = "toast" + (isError ? " error" : "");
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, isError ? 5200 : 3000);
  };

  A.errMsg = function (e) {
    var c = e && e.code ? e.code : "";
    if (c === "permission-denied") return "مفيش صلاحية. تأكد إن قواعد Firestore (firestore.rules) منشورة.";
    if (c === "unavailable") return "مفيش اتصال بالإنترنت.";
    return (e && e.message) || "حصل خطأ غير متوقع.";
  };

  /* ---------------- Modal ---------------- */

  A.modal = {
    open: function (html, wide) {
      var box = $("#modalBox");
      box.className = "modal-box" + (wide ? " wide" : "");
      box.innerHTML = html;
      $("#modal").hidden = false;
      var f = box.querySelector("[autofocus],button,input");
      if (f) f.focus();
      return box;
    },
    close: function () { $("#modal").hidden = true; $("#modalBox").innerHTML = ""; }
  };

  A.confirm = function (title, text, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var box = A.modal.open('<h3>' + esc(title) + '</h3><p>' + esc(text || "") + '</p>' +
        '<div class="modal-actions"><button class="btn ' + (opts.danger === false ? "btn-primary" : "btn-danger") + '" data-ok autofocus>' + esc(opts.ok || "تأكيد") + '</button>' +
        '<button class="btn btn-ghost" data-no>إلغاء</button></div>');
      function done(v) { A.modal.close(); resolve(v); }
      box.querySelector("[data-ok]").onclick = function () { done(true); };
      box.querySelector("[data-no]").onclick = function () { done(false); };
      A._modalCancel = function () { done(false); };
    });
  };

  /* ---------------- Image compression (بدون Firebase Storage) ---------------- */

  var webpOk = (function () {
    try { return document.createElement("canvas").toDataURL("image/webp").indexOf("data:image/webp") === 0; } catch (e) { return false; }
  })();

  A.bytesOf = function (dataUrl) { return Math.round(String(dataUrl || "").length * 0.75); };
  A.kb = function (b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + " ميجا" : Math.round(b / 1024) + " كيلوبايت"; };

  A.compress = function (file, o) {
    o = Object.assign({ maxW: 1200, maxH: 1200, maxBytes: 230 * 1024 }, o || {});
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
        reject(new Error("نوع الملف غير مدعوم. استخدم صورة PNG أو JPG أو WebP."));
        return;
      }
      if (file.size > 25 * 1024 * 1024) { reject(new Error("الصورة كبيرة جداً (أقصى حجم 25 MB).")); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("تعذر قراءة الصورة.")); };
      img.onload = function () {
        URL.revokeObjectURL(url);
        var scale = Math.min(1, o.maxW / img.width, o.maxH / img.height);
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var type = webpOk ? "image/webp" : "image/jpeg";
        var q = 0.84, data = "";
        for (var i = 0; i < 8; i++) {
          var c = document.createElement("canvas");
          c.width = w; c.height = h;
          var ctx = c.getContext("2d");
          if (type === "image/jpeg") { ctx.fillStyle = "#101216"; ctx.fillRect(0, 0, w, h); }
          ctx.drawImage(img, 0, 0, w, h);
          data = c.toDataURL(type, q);
          if (A.bytesOf(data) <= o.maxBytes) break;
          if (q > 0.52) q -= 0.1; else { w = Math.round(w * 0.85); h = Math.round(h * 0.85); }
        }
        if (A.bytesOf(data) > 900 * 1024) { reject(new Error("الصورة لسه كبيرة بعد الضغط. جرّب صورة أصغر.")); return; }
        resolve({ data: data, w: w, h: h, bytes: A.bytesOf(data), name: file.name });
      };
      img.src = url;
    });
  };

  /* ---------------- Data helpers ---------------- */

  A.col = function (n) { return A.db.collection(n); };

  A.list = function (name) {
    return A.col(name).get().then(function (snap) {
      return snap.docs.map(function (d, i) {
        var x = d.data() || {}; x._id = d.id;
        if (typeof x.order !== "number") x.order = i;
        return x;
      }).sort(function (a, b) { return a.order - b.order; });
    });
  };

  function chunk(arr, n) { var out = []; for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }

  A.batchRun = function (ops, size) {
    // ops: [{type:'set'|'delete', ref, data}] — مقسمة على دفعات صغيرة (الصور بتزوّد الحجم)
    return chunk(ops, size || 20).reduce(function (p, part) {
      return p.then(function () {
        var b = A.db.batch();
        part.forEach(function (o) { if (o.type === "delete") b.delete(o.ref); else if (o.merge) b.set(o.ref, o.data, { merge: true }); else b.set(o.ref, o.data); });
        return b.commit();
      });
    }, Promise.resolve());
  };

  var SEED_NAMES = ["stats", "services", "steps", "works", "workCategories", "tools", "toolCategories", "testimonials", "faqs"];
  A.SEED_NAMES = SEED_NAMES;

  // استيراد محتوى data.js إلى Firestore عشان يبقى قابل للتعديل من اللوحة
  A.seed = function (names, replace) {
    var D = window.TWINS_DATA || {};
    names = names || SEED_NAMES;
    var ops = [];
    return Promise.all(names.map(function (n) { return A.col(n).get(); })).then(function (snaps) {
      names.forEach(function (n, idx) {
        var snap = snaps[idx];
        if (snap.size && !replace) return;
        if (replace) snap.docs.forEach(function (d) { ops.push({ type: "delete", ref: d.ref }); });
        (D[n] || []).forEach(function (item, i) {
          ops.push({ type: "set", ref: A.col(n).doc(), data: Object.assign({}, item, { order: i + 1, active: true }) });
        });
      });
      if (!snaps.length) return null;
      return A.batchRun(ops, 400);
    }).then(function () { return ops.filter(function (o) { return o.type === "set"; }).length; });
  };

  A.seedContact = function () {
    var c = (window.TWINS_DATA || {}).contact || {};
    return A.db.doc("site/contact").get().then(function (d) {
      if (d.exists) return false;
      return A.db.doc("site/contact").set(c).then(function () { return true; });
    });
  };

  /* ---------------- Navigation ---------------- */

  A.NAV = [
    { g: "عام" },
    { id: "overview", label: "نظرة عامة", ico: "▦" },
    { g: "محتوى الموقع" },
    { id: "settings", label: "إعدادات الموقع", ico: "🎛" },
    { id: "services", label: "الخدمات والأسعار", ico: "⚙" },
    { id: "steps", label: "خطوات العمل", ico: "🧭" },
    { id: "works", label: "معرض الأعمال", ico: "🖼" },
    { id: "tools", label: "الأدوات", ico: "⬇" },
    { id: "testimonials", label: "آراء العملاء", ico: "⭐" },
    { id: "faqs", label: "الأسئلة الشائعة", ico: "❓" },
    { id: "stats", label: "الإحصائيات", ico: "📊" },
    { id: "toolCategories", label: "تصنيفات الأدوات", ico: "🏷" },
    { id: "workCategories", label: "تصنيفات الأعمال", ico: "🏷" },
    { g: "الوسائط" },
    { id: "media", label: "مكتبة الصور", ico: "📷" },
    { g: "العملاء" },
    { id: "requests", label: "طلبات العملاء", ico: "📥", badge: true },
    { id: "members", label: "العملاء والعضويات", ico: "💎" },
    { id: "proVault", label: "محتوى PRO", ico: "🔐" },
    { id: "users", label: "الأعضاء المسجلين", ico: "👥" },
    { id: "downloads", label: "سجل التحميلات", ico: "📈" },
    { id: "comments", label: "التعليقات والموافقة", ico: "💬" },
    { id: "codes", label: "أكواد PRO", ico: "🎟" },
    { id: "activity", label: "سجل النشاط", ico: "📜" },
    { g: "النظام" },
    { id: "admins", label: "الشركاء / الأدمنز", ico: "🔑" },
    { id: "backup", label: "نسخ احتياطي واستيراد", ico: "💾" }
  ];

  function renderNav() {
    var group = "";
    $("#adminNav").innerHTML = A.NAV.map(function (n) {
      if (n.g) return '<div class="nav-group">' + esc(n.g) + '</div>';
      return '<button type="button" data-section="' + n.id + '" class="' + (n.id === A.current ? "active" : "") + '">' +
        '<span class="ico" aria-hidden="true">' + n.ico + '</span><span>' + esc(n.label) + '</span>' +
        (n.badge ? '<span class="badge" id="badge_' + n.id + '" hidden></span>' : "") + '</button>';
    }).join("");
  }

  A.setBadge = function (id, n) {
    var el = $("#badge_" + id);
    if (!el) return;
    el.textContent = n; el.hidden = !n;
  };

  A.refreshBadges = function () {
    A.col("requests").where("status", "==", "جديد").get()
      .then(function (s) { A.setBadge("requests", s.size); })
      .catch(function () { /* تجاهل */ });
  };

  A.go = function (id, noHash) {
    var item = null, grp = "";
    A.NAV.forEach(function (n) { if (n.g) grp = n.g; else if (n.id === id) item = { n: n, g: grp }; });
    if (!item) { id = "overview"; item = { n: A.NAV[1], g: "عام" }; }
    A.current = id;
    $$("#adminNav button").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-section") === id); });
    document.body.classList.remove("admin-menu-open");
    $("#pageTitle").textContent = item.n.label;
    $("#pageCrumb").textContent = item.g;
    if (!noHash && location.hash !== "#" + id) { try { history.pushState(null, "", "#" + id); } catch (e) { location.hash = id; } }
    var box = $("#adminContent");
    box.innerHTML = '<div class="empty-state">جاري التحميل…</div>';
    window.scrollTo(0, 0);
    var view = A.views[id];
    if (view) {
      try { view(box); } catch (e) { box.innerHTML = '<div class="empty-state">خطأ في عرض القسم: ' + esc(e.message) + '</div>'; console.error(e); }
    }
  };

  /* ---------------- Boot ---------------- */

  function loginError(msg) { var e = $("#loginError"); e.textContent = msg || ""; e.hidden = !msg; if (msg) $("#loginOk").hidden = true; }
  function loginOk(msg) { var e = $("#loginOk"); e.textContent = msg || ""; e.hidden = !msg; if (msg) $("#loginError").hidden = true; }

  function authMessage(err) {
    var m = {
      "auth/invalid-credential": "الإيميل أو كلمة المرور غلط.",
      "auth/invalid-email": "صيغة الإيميل مش صحيحة.",
      "auth/user-not-found": "مفيش حساب بالإيميل ده.",
      "auth/wrong-password": "كلمة المرور غلط.",
      "auth/too-many-requests": "محاولات كتير. استنى شوية وجرّب تاني.",
      "auth/network-request-failed": "مفيش اتصال بالإنترنت.",
      "auth/unauthorized-domain": "الدومين ده مش مضاف في Firebase → Authentication → Authorized domains."
    };
    return m[err && err.code] || (err && err.message) || "حصل خطأ.";
  }

  function onUser(user) {
    if (!user) {
      A.user = null;
      $("#loginView").hidden = false; $("#adminView").hidden = true;
      return;
    }
    var email = (user.email || "").toLowerCase();
    A.isPrimary = email === A.PRIMARY;
    var check = A.isPrimary ? Promise.resolve(true) :
      A.db.collection("admins").doc(email).get().then(function (d) { return d.exists && d.data().active !== false; }).catch(function () { return false; });

    check.then(function (ok) {
      if (!ok) {
        A.auth.signOut();
        loginError("الحساب (" + email + ") ملوش صلاحية أدمن.");
        $("#loginView").hidden = false; $("#adminView").hidden = true;
        return;
      }
      A.user = user;
      loginError("");
      $("#loginView").hidden = true; $("#adminView").hidden = false;
      $("#userEmail").textContent = (A.isPrimary ? "👑 " : "") + email;
      renderNav();
      A.refreshBadges();
      var start = (location.hash || "").replace("#", "") || "overview";
      A.go(start, true);
    });
  }

  A.start = function () {
    if (!window.firebase || !window.TWINS_FIREBASE_CONFIG) { loginError("Firebase مش محمّل — تأكد من الاتصال بالإنترنت."); return; }
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.TWINS_FIREBASE_CONFIG);
      A.auth = firebase.auth();
      A.db = firebase.firestore();
    } catch (e) { loginError("خطأ في إعداد Firebase: " + e.message); return; }

    $("#loginForm").addEventListener("submit", function (e) {
      e.preventDefault();
      loginError("");
      var btn = $("#loginBtn");
      btn.disabled = true; btn.textContent = "جاري الدخول…";
      A.auth.signInWithEmailAndPassword($("#adminEmail").value.trim(), $("#adminPassword").value)
        .catch(function (err) { loginError(authMessage(err)); })
        .then(function () { btn.disabled = false; btn.textContent = "دخول ←"; });
    });
    $("#passToggle").addEventListener("click", function () {
      var i = $("#adminPassword"), show = i.type === "password";
      i.type = show ? "text" : "password";
      this.textContent = show ? "إخفاء" : "إظهار";
    });
    $("#forgotBtn").addEventListener("click", function () {
      var email = $("#adminEmail").value.trim();
      if (!email) { loginError("اكتب الإيميل الأول وبعدين اضغط «نسيت كلمة المرور»."); return; }
      A.auth.sendPasswordResetEmail(email)
        .then(function () { loginOk("بعتنا رابط إعادة تعيين كلمة المرور على " + email); })
        .catch(function (err) { loginError(authMessage(err)); });
    });
    $("#logoutBtn").addEventListener("click", function () { A.auth.signOut(); });

    var toggle = $("#adminMenuToggle");
    function menu(open) {
      document.body.classList.toggle("admin-menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    }
    toggle.addEventListener("click", function () { menu(!document.body.classList.contains("admin-menu-open")); });
    $("#sidebarBackdrop").addEventListener("click", function () { menu(false); });
    $("#adminNav").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-section]");
      if (b) A.go(b.getAttribute("data-section"));
    });
    window.addEventListener("popstate", function () {
      if (A.user) A.go((location.hash || "").replace("#", "") || "overview", true);
    });

    $("#modal").addEventListener("mousedown", function (e) {
      if (e.target.id === "modal") { if (A._modalCancel) A._modalCancel(); A._modalCancel = null; A.modal.close(); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("#modal").hidden) { if (A._modalCancel) A._modalCancel(); A._modalCancel = null; A.modal.close(); }
    });

    A.auth.onAuthStateChanged(onUser);
  };

  return A;
})();
