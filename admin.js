/* TWINS GSM — Admin Panel (Firebase Auth + Firestore + Storage) */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var app, auth, db;
  var currentSection = "overview";
  var toastTimer = null;

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function toast(msg) {
    var el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3200);
  }

  function fmt(ts) {
    if (!ts) return "—";
    try { return ts.toDate ? ts.toDate().toLocaleString("ar-EG") : new Date(ts).toLocaleString("ar-EG"); }
    catch (e) { return "—"; }
  }

  function showError(msg) {
    var el = $("#loginError");
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
  }

  /* ---------------- Schema ---------------- */

  var SCHEMAS = {
    tools: {
      title: "الأدوات", icon: "⬇", desc: "ضيف أداة واربطها بملف داخل مجلد tools أو برابط خارجي.",
      listTitle: function (d) { return d.name || "أداة بدون اسم"; },
      listSub: function (d) { return (d.tag || d.category || "—") + " · " + (d.version || "v1.0") + " · " + (d.size || "—"); },
      fields: [
        { key: "name", label: "اسم الأداة", type: "text", required: true, full: true },
        { key: "desc", label: "الوصف", type: "textarea", full: true },
        { key: "category", label: "التصنيف (frp / network / flash)", type: "text" },
        { key: "tag", label: "الوسم الظاهر على الكارت", type: "text" },
        { key: "version", label: "الإصدار", type: "text" },
        { key: "size", label: "الحجم", type: "text" },
        { key: "order", label: "الترتيب", type: "number" },
        { key: "hot", label: "أداة مميزة", type: "checkbox" },
        { key: "file", label: "مسار الملف أو رابط التحميل", type: "text", full: true, hint: "مثال: tools/my-tool.zip أو رابط خارجي مباشر. ارفع الملف أولاً داخل مجلد tools ثم انشر الموقع." }
      ]
    },
    works: {
      title: "الأعمال", icon: "🖼", desc: "الأجهزة اللي أصلحتها والمعرض على الصفحة الرئيسية.",
      listTitle: function (d) { return d.model || "جهاز بدون اسم"; },
      listSub: function (d) { return (d.brand || "—") + " · " + (d.category || "—"); },
      fields: [
        { key: "brand", label: "البراند", type: "text", required: true },
        { key: "model", label: "الموديل", type: "text", required: true },
        { key: "category", label: "التصنيف (iphone / samsung / xiaomi / tablet / other)", type: "text", full: true },
        { key: "desc", label: "وصف الشغل", type: "textarea", full: true },
        { key: "order", label: "الترتيب", type: "number" }
      ]
    },
    testimonials: {
      title: "آراء العملاء", icon: "⭐", desc: "اعرض كلام عملائك الحقيقي.",
      listTitle: function (d) { return d.name || "عميل"; },
      listSub: function (d) { return d.text || ""; },
      fields: [
        { key: "name", label: "الاسم", type: "text", required: true },
        { key: "role", label: "الوصف (مثلاً: عميل)", type: "text" },
        { key: "text", label: "الرأي", type: "textarea", required: true, full: true },
        { key: "order", label: "الترتيب", type: "number" }
      ]
    },
    services: {
      title: "الخدمات", icon: "⚙", desc: "البطاقات اللي بتظهر في قسم الخدمات.",
      listTitle: function (d) { return d.title || "خدمة بدون اسم"; },
      listSub: function (d) { return d.desc || ""; },
      fields: [
        { key: "title", label: "عنوان الخدمة", type: "text", required: true },
        { key: "tag", label: "الوسم (مثلاً FRP)", type: "text" },
        { key: "icon", label: "الأيقونة", type: "select", options: ["bolt", "lock", "globe", "signal", "laptop", "shield"] },
        { key: "desc", label: "الوصف", type: "textarea", required: true, full: true },
        { key: "price", label: "السعر (مثلاً 150 ج.م)", type: "text" },
        { key: "priceNote", label: "ملاحظة السعر", type: "text" },
        { key: "order", label: "الترتيب", type: "number" }
      ]
    },
    stats: {
      title: "الإحصائيات", icon: "📊", desc: "الأرقام الظاهرة تحت الهيرو.",
      listTitle: function (d) { return d.value || "—"; },
      listSub: function (d) { return d.label || ""; },
      fields: [
        { key: "value", label: "القيمة (مثلاً +502)", type: "text", required: true },
        { key: "label", label: "الوصف", type: "text", required: true },
        { key: "order", label: "الترتيب", type: "number" }
      ]
    },
    faqs: {
      title: "الأسئلة الشائعة", icon: "❓", desc: "الأسئلة والأجوبة في آخر الصفحة.",
      listTitle: function (d) { return d.q || "سؤال بدون عنوان"; },
      listSub: function (d) { return d.a || ""; },
      fields: [
        { key: "q", label: "السؤال", type: "text", required: true, full: true },
        { key: "a", label: "الإجابة", type: "textarea", required: true, full: true },
        { key: "order", label: "الترتيب", type: "number" }
      ]
    },
    toolCategories: {
      title: "تصنيفات الأدوات", icon: "🏷", desc: "فلتر البحث في قسم الأدوات.",
      listTitle: function (d) { return d.label || "—"; },
      listSub: function (d) { return "id: " + (d.id || "—"); },
      fields: [
        { key: "label", label: "الاسم الظاهر", type: "text", required: true },
        { key: "id", label: "المعرّف (مثلاً frp)", type: "text", required: true },
        { key: "order", label: "الترتيب", type: "number" }
      ]
    },
    workCategories: {
      title: "تصنيفات الأعمال", icon: "🏷", desc: "فلتر معرض الأعمال.",
      listTitle: function (d) { return d.label || "—"; },
      listSub: function (d) { return "id: " + (d.id || "—"); },
      fields: [
        { key: "label", label: "الاسم الظاهر", type: "text", required: true },
        { key: "id", label: "المعرّف (مثلاً iphone)", type: "text", required: true },
        { key: "order", label: "الترتيب", type: "number" }
      ]
    }
  };

  var NAV = [
    { id: "overview", label: "نظرة عامة", icon: "▦" },
    { id: "tools", label: "الأدوات", icon: "⬇" },
    { id: "works", label: "الأعمال", icon: "🖼" },
    { id: "testimonials", label: "الآراء", icon: "⭐" },
    { id: "services", label: "الخدمات", icon: "⚙" },
    { id: "stats", label: "الإحصائيات", icon: "📊" },
    { id: "faqs", label: "الأسئلة الشائعة", icon: "❓" },
    { id: "toolCategories", label: "تصنيفات الأدوات", icon: "🏷" },
    { id: "workCategories", label: "تصنيفات الأعمال", icon: "🏷" },
    { id: "requests", label: "طلبات العملاء", icon: "📥" },
    { id: "users", label: "الأعضاء المسجلين", icon: "👥" },
    { id: "downloads", label: "سجل التحميلات", icon: "📈" },
    { id: "admins", label: "الشركاء / الأدمنز", icon: "🔑" },
    { id: "site", label: "بيانات التواصل", icon: "✆" }
  ];

  /* ---------------- Auth ---------------- */

  function init() {
    if (!window.firebase || !window.TWINS_FIREBASE_CONFIG) {
      showError("Firebase مش محمّل — تأكد من الاتصال بالإنترنت.");
      return;
    }
    try {
      app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.TWINS_FIREBASE_CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
    } catch (e) {
      showError("خطأ في إعداد Firebase: " + e.message);
      return;
    }

    $("#loginForm").addEventListener("submit", function (e) {
      e.preventDefault();
      showError("");
      var btn = $("#loginBtn");
      btn.disabled = true;
      btn.textContent = "جاري الدخول…";
      auth.signInWithEmailAndPassword($("#adminEmail").value.trim(), $("#adminPassword").value)
        .catch(function (err) {
          showError(err.code === "auth/invalid-credential" ? "الإيميل أو كلمة المرور غلط." : err.message);
        })
        .then(function () {
          btn.disabled = false;
          btn.textContent = "دخول ←";
        });
    });

    $("#logoutBtn").addEventListener("click", function () {
      auth.signOut();
    });

    var adminToggle = $("#adminMenuToggle");
    adminToggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("admin-menu-open");
      adminToggle.setAttribute("aria-expanded", String(open));
    });

    auth.onAuthStateChanged(function (user) {
      if (user) {
        $("#loginView").hidden = true;
        $("#adminView").hidden = false;
        $("#userEmail").textContent = user.email || "—";
        renderNav();
        setSection("overview");
      } else {
        $("#loginView").hidden = false;
        $("#adminView").hidden = true;
      }
    });

    renderNav();
  }

  /* ---------------- Navigation ---------------- */

  function renderNav() {
    var nav = $("#adminNav");
    nav.innerHTML = NAV.map(function (n) {
      return '<button type="button" data-section="' + n.id + '" class="' + (n.id === currentSection ? 'active' : '') + '">' +
        '<span aria-hidden="true">' + n.icon + '</span><span>' + n.label + '</span></button>';
    }).join("");
  }

  function setSection(id) {
    currentSection = id;
    $$("#adminNav button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-section") === id);
    });
    document.body.classList.remove("admin-menu-open");

    var item = NAV.filter(function (n) { return n.id === id; })[0];
    $("#pageTitle").textContent = item ? item.label : "لوحة التحكم";

    if (id === "overview") renderOverview();
    else if (id === "site") renderSite();
    else if (id === "requests") renderRequests();
    else if (id === "users") renderUsers();
    else if (id === "downloads") renderDownloads();
    else if (id === "admins") renderAdmins();
    else renderCollection(id);
  }

  $("#adminNav") && $("#adminNav").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-section]");
    if (btn) setSection(btn.getAttribute("data-section"));
  });

  /* ---------------- Overview ---------------- */

  function renderOverview() {
    var content = $("#adminContent");
    content.innerHTML = '<div class="overview-grid" id="overviewGrid"><div class="overview-card">جاري التحميل…</div></div>' +
      '<div class="overview-note">مبروك 💛 الموقع هيقرأ تلقائياً من Firestore. أي تعديل هنا هيظهر على الموقع بعد تحديث الصفحة.</div>';

    var names = ["tools", "works", "testimonials", "services", "stats", "faqs", "toolCategories", "workCategories", "users", "requests", "downloads", "admins"];
    Promise.all(names.map(function (name) {
      return db.collection(name).get().then(function (s) { return { name: name, count: s.size }; }).catch(function () { return { name: name, count: 0 }; });
    })).then(function (results) {
      var labels = { users: "الأعضاء", requests: "الطلبات", downloads: "التحميلات", admins: "الشركاء" };
      $("#overviewGrid").innerHTML = results.map(function (r) {
        var label = (SCHEMAS[r.name] && SCHEMAS[r.name].title) || labels[r.name] || r.name;
        return '<div class="overview-card"><b>' + r.count + '</b><span>' + esc(label) + '</span></div>';
      }).join("");
    });
  }

  /* ---------------- Fields ---------------- */

  function fieldHtml(f, value, doc) {
    var v = value == null ? "" : value;
    var id = "f_" + f.key;
    var cls = "form-field" + (f.full ? " full" : "") + (f.type === "checkbox" ? " checkbox-field" : "");
    var html = '<div class="' + cls + '">';

    if (f.type === "checkbox") {
      html += '<input type="checkbox" id="' + id + '" ' + (v === true ? "checked" : "") + ' />';
      html += '<label for="' + id + '">' + esc(f.label) + '</label>';
    } else if (f.type === "textarea") {
      html += '<label for="' + id + '">' + esc(f.label) + (f.required ? ' *' : '') + '</label>';
      html += '<textarea id="' + id + '" ' + (f.required ? "required" : "") + '>' + esc(v) + '</textarea>';
    } else if (f.type === "select") {
      html += '<label for="' + id + '">' + esc(f.label) + '</label><select id="' + id + '">';
      (f.options || []).forEach(function (o) {
        html += '<option value="' + esc(o) + '" ' + (v === o ? "selected" : "") + '>' + esc(o) + '</option>';
      });
      html += '</select>';
    } else if (f.type === "file") {
      html += '<label for="' + id + '">' + esc(f.label) + '</label><input type="file" id="' + id + '" accept=".zip,.pdf,.rar,.7z,.txt" />';
      if (f.hint) html += '<span class="hint">' + esc(f.hint) + '</span>';
      if (doc && doc.file) html += '<span class="hint">الملف الحالي: ' + esc(doc.file) + '</span>';
    } else {
      html += '<label for="' + id + '">' + esc(f.label) + (f.required ? ' *' : '') + '</label>';
      html += '<input type="' + (f.type === "number" ? "number" : "text") + '" id="' + id + '" value="' + esc(v) + '" ' + (f.required ? "required" : "") + ' />';
      if (f.hint) html += '<span class="hint">' + esc(f.hint) + '</span>';
    }

    html += '</div>';
    return html;
  }

  function renderForm(section, doc) {
    var schema = SCHEMAS[section];
    var form = $("#adminForm");
    if (!form || !schema) return;

    form.dataset.section = section;
    form.dataset.id = doc && doc._id ? doc._id : "";
    $("#formTitle").textContent = doc ? "تعديل: " + (schema.listTitle(doc) || "") : "إضافة جديد";

    $("#formFields").innerHTML = schema.fields.map(function (f) {
      return fieldHtml(f, doc ? doc[f.key] : (f.type === "number" ? 0 : (f.type === "checkbox" ? false : "")), doc);
    }).join("");

    $("#cancelEdit").hidden = !doc;
    $("#submitBtn").textContent = doc ? "حفظ التعديلات" : "إضافة";
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------------- Collection CRUD ---------------- */

  function renderCollection(section) {
    var schema = SCHEMAS[section];
    var content = $("#adminContent");
    if (!schema) return;

    content.innerHTML =
      '<div class="panel-head"><div><h2>' + esc(schema.title) + '</h2><p>' + esc(schema.desc) + '</p></div>' +
      '<button class="btn btn-primary btn-sm" type="button" id="addNewBtn">+ إضافة جديد</button></div>' +
      '<form class="form-card" id="adminForm" hidden>' +
      '<h3 id="formTitle">إضافة جديد</h3><div class="form-grid" id="formFields"></div>' +
      '<div class="form-actions"><button class="btn btn-primary" type="submit" id="submitBtn">إضافة</button>' +
      '<button class="btn btn-ghost" type="button" id="cancelEdit" hidden>إلغاء</button></div></form>' +
      '<div class="item-list" id="itemList"><div class="empty-state">جاري التحميل…</div></div>';

    $("#addNewBtn").addEventListener("click", function () { renderForm(section, null); });
    $("#cancelEdit").addEventListener("click", function () { $("#adminForm").hidden = true; });
    $("#adminForm").addEventListener("submit", function (e) { e.preventDefault(); saveDoc(e.currentTarget); });

    db.collection(section).get().then(function (snap) {
      var docs = snap.docs.map(function (d) {
        var data = d.data() || {};
        data._id = d.id;
        if (typeof data.order !== "number") data.order = 0;
        return data;
      }).sort(function (a, b) { return a.order - b.order; });

      var list = $("#itemList");
      if (!docs.length) {
        list.innerHTML = '<div class="empty-state">مفيش عناصر هنا لسه. اضغط «إضافة جديد».</div>';
        return;
      }
      list.innerHTML = docs.map(function (d) {
        return '<div class="item-row"><div class="item-main"><b>' + esc(schema.listTitle(d)) + '</b>' +
          '<small>' + esc(schema.listSub(d)) + '</small></div><div class="item-actions">' +
          '<button class="icon-btn" type="button" data-edit="' + esc(d._id) + '" title="تعديل">✎</button>' +
          '<button class="icon-btn danger" type="button" data-delete="' + esc(d._id) + '" title="حذف">🗑</button>' +
          '</div></div>';
      }).join("");

      $$("[data-edit]", list).forEach(function (btn) {
        btn.addEventListener("click", function () {
          renderForm(section, docs.filter(function (d) { return d._id === btn.getAttribute("data-edit"); })[0]);
        });
      });
      $$("[data-delete]", list).forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (!confirm("متأكد إنك عايز تمسح العنصر ده؟")) return;
          var id = btn.getAttribute("data-delete");
          db.collection(section).doc(id).delete()
            .then(function () { toast("تم الحذف"); renderCollection(section); })
            .catch(function (e) { toast("خطأ في الحذف: " + e.message); });
        });
      });
    }).catch(function (e) {
      $("#itemList").innerHTML = '<div class="empty-state">خطأ في التحميل: ' + esc(e.message) + '</div>';
    });
  }

  function saveDoc(form) {
    var section = form.dataset.section;
    var id = form.dataset.id;
    var schema = SCHEMAS[section];
    var data = {};

    schema.fields.forEach(function (f) {
      if (f.type === "file") return;
      var el = $("#f_" + f.key, form);
      if (!el) return;
      if (f.type === "checkbox") data[f.key] = el.checked;
      else if (f.type === "number") data[f.key] = Number(el.value || 0);
      else data[f.key] = el.value.trim();
    });

    if (section === "tools") {
      if (!data.file) data.file = "#";
      delete data.storagePath;
    }

    var saveTask = id
      ? db.collection(section).doc(id).set(data, { merge: true })
      : (function () {
          if (typeof data.order !== "number") data.order = Date.now();
          return db.collection(section).add(data);
        })();

    saveTask.then(function () {
      toast(id ? "تم حفظ التعديلات" : "تمت الإضافة بنجاح");
      renderCollection(section);
    }).catch(function (e) {
      toast("خطأ: " + e.message);
    });
  }

  /* ---------------- Clients / partners ---------------- */

  function renderRequests() {
    var content = $("#adminContent");
    content.innerHTML = '<div class="panel-head"><div><h2>طلبات العملاء</h2><p>تابع طلبات الصيانة وغيّر الحالتها.</p></div></div>' +
      '<div class="item-list" id="reqList"><div class="empty-state">جاري التحميل…</div></div>';

    db.collection("requests").orderBy("createdAt", "desc").get().then(function (snap) {
      var list = $("#reqList");
      if (!snap.size) { list.innerHTML = '<div class="empty-state">مفيش طلبات لسه.</div>'; return; }
      list.innerHTML = snap.docs.map(function (d) {
        var r = d.data() || {};
        return '<div class="item-row"><div class="item-main"><b>' + esc(r.device || "جهاز") + ' — ' + esc(r.service || "خدمة") + '</b>' +
          '<small>' + esc(r.email || "—") + ' · ' + esc(r.note || "") + ' · ' + fmt(r.createdAt) + '</small></div>' +
          '<div class="item-actions">' +
          '<button class="icon-btn" type="button" data-status="' + esc(d.id) + '" data-value="جديد" title="جديد">↺</button>' +
          '<button class="icon-btn" type="button" data-status="' + esc(d.id) + '" data-value="قيد التنفيذ" title="قيد التنفيذ">◷</button>' +
          '<button class="icon-btn" type="button" data-status="' + esc(d.id) + '" data-value="تم التنفيذ" title="تم التنفيذ">✓</button>' +
          '</div></div>';
      }).join("");

      $$("[data-status]", list).forEach(function (btn) {
        btn.addEventListener("click", function () {
          db.collection("requests").doc(btn.getAttribute("data-status"))
            .update({ status: btn.getAttribute("data-value") })
            .then(function () { toast("تم تحديث الحالة"); renderRequests(); })
            .catch(function (e) { toast("خطأ: " + e.message); });
        });
      });
    }).catch(function (e) {
      $("#reqList").innerHTML = '<div class="empty-state">خطأ: ' + esc(e.message) + '</div>';
    });
  }

  function renderUsers() {
    var content = $("#adminContent");
    content.innerHTML = '<div class="panel-head"><div><h2>الأعضاء المسجلين</h2><p>كل من عمل حساب على الموقع.</p></div></div>' +
      '<div class="item-list" id="usersList"><div class="empty-state">جاري التحميل…</div></div>';

    db.collection("users").orderBy("createdAt", "desc").get().then(function (snap) {
      var list = $("#usersList");
      if (!snap.size) { list.innerHTML = '<div class="empty-state">لسه مفيش أعضاء.</div>'; return; }
      list.innerHTML = snap.docs.map(function (d) {
        var u = d.data() || {};
        return '<div class="item-row"><div class="item-main"><b>' + esc(u.name || u.email || "عضو") + '</b>' +
          '<small>' + esc(u.email || "—") + ' · ' + esc(u.role || "member") + ' · ' + fmt(u.createdAt) + '</small></div></div>';
      }).join("");
    }).catch(function () {
      $("#usersList").innerHTML = '<div class="empty-state">خطأ في التحميل.</div>';
    });
  }

  function renderDownloads() {
    var content = $("#adminContent");
    content.innerHTML = '<div class="panel-head"><div><h2>سجل التحميلات</h2><p>آخر الأدوات اللي الأعضاء نزلوها.</p></div></div>' +
      '<div class="item-list" id="downloadsList"><div class="empty-state">جاري التحميل…</div></div>';

    db.collection("downloads").orderBy("createdAt", "desc").limit(100).get().then(function (snap) {
      var list = $("#downloadsList");
      if (!snap.size) { list.innerHTML = '<div class="empty-state">لسه مفيش تحميلات.</div>'; return; }
      list.innerHTML = snap.docs.map(function (d) {
        var r = d.data() || {};
        return '<div class="item-row"><div class="item-main"><b>' + esc(r.toolName || "أداة") + '</b>' +
          '<small>' + esc(r.email || "—") + ' · ' + fmt(r.createdAt) + '</small></div></div>';
      }).join("");
    }).catch(function () {
      $("#downloadsList").innerHTML = '<div class="empty-state">خطأ في التحميل.</div>';
    });
  }

  function renderAdmins() {
    var primary = "hondastore299@gmail.com";
    var content = $("#adminContent");
    content.innerHTML =
      '<div class="panel-head"><div><h2>الشركاء / الأدمنز</h2><p>ضيف شريك بالايميل الخاص بيه، هيقدر يتحكم في بيانات الموقع.</p></div></div>' +
      '<form class="form-card" id="adminPartnerForm"><h3>إضافة شريك</h3><div class="form-grid">' +
      fieldHtml({ key: "email", label: "إيميل الشريك", type: "text", required: true, full: true }, "") +
      fieldHtml({ key: "name", label: "الاسم", type: "text" }, "") +
      '</div><div class="form-actions"><button class="btn btn-primary" type="submit">إضافة / تحديث</button></div></form>' +
      '<div class="item-list" id="partnerList"><div class="empty-state">جاري التحميل…</div></div>';

    db.collection("admins").get().then(function (snap) {
      var list = $("#partnerList");
      var docs = snap.docs.map(function (d) { var x = d.data() || {}; x._id = d.id; return x; });
      var hasPrimary = docs.some(function (d) { return d._id === primary; });
      var rows = docs.map(function (d) {
        var isPrimary = d._id === primary;
        return '<div class="item-row"><div class="item-main"><b>' + esc(d.name || d._id) + (isPrimary ? ' 👑' : '') + '</b>' +
          '<small>' + esc(d._id) + ' · ' + (d.active === false ? 'معطّل' : 'نشط') + '</small></div>' +
          '<div class="item-actions">' + (isPrimary ? '' : '<button class="icon-btn danger" type="button" data-remove="' + esc(d._id) + '" title="إزالة">🗑</button>') + '</div></div>';
      });
      if (!hasPrimary) {
        rows.unshift('<div class="item-row"><div class="item-main"><b>' + primary + ' 👑</b><small>الأدمن الأساسي</small></div></div>');
      }
      list.innerHTML = rows.join("") || '<div class="empty-state">لسه مفيش شركاء.</div>';

      $$("[data-remove]", list).forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (!confirm("متأكد إنك عايز تشيل الشريك ده؟")) return;
          db.collection("admins").doc(btn.getAttribute("data-remove")).delete()
            .then(function () { toast("تمت الإزالة"); renderAdmins(); })
            .catch(function (e) { toast("خطأ: " + e.message); });
        });
      });
    }).catch(function () {
      $("#partnerList").innerHTML = '<div class="empty-state">خطأ في التحميل.</div>';
    });

    $("#adminPartnerForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var email = $("#f_email").value.trim().toLowerCase();
      if (!email) return;
      db.collection("admins").doc(email).set({
        email: email,
        name: $("#f_name").value.trim() || email.split("@")[0],
        active: true,
        addedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).then(function () {
        toast("تمت إضافة الشريك");
        renderAdmins();
      }).catch(function (err) { toast("خطأ: " + err.message); });
    });
  }

  /* ---------------- Site contact ---------------- */

  function renderSite() {
    var content = $("#adminContent");
    content.innerHTML =
      '<div class="panel-head"><div><h2>بيانات التواصل</h2><p>رقم واتساب والإيميل والروابط الاجتماعية.</p></div></div>' +
      '<form class="form-card" id="siteForm"><h3>تعديل بيانات التواصل</h3><div class="form-grid">' +
      fieldHtml({ key: "phoneDisplay", label: "الرقم الظاهر", type: "text", required: true }, "") +
      fieldHtml({ key: "whatsapp", label: "رابط واتساب (wa.me)", type: "text", required: true, full: true }, "") +
      fieldHtml({ key: "email", label: "الإيميل", type: "text" }, "") +
      fieldHtml({ key: "facebook", label: "رابط فيسبوك", type: "text" }, "") +
      fieldHtml({ key: "tiktok", label: "رابط تيك توك", type: "text" }, "") +
      fieldHtml({ key: "instagram", label: "رابط إنستغرام", type: "text" }, "") +
      '</div><div class="form-actions"><button class="btn btn-primary" type="submit">حفظ</button></div></form>';

    db.doc("site/contact").get().then(function (doc) {
      var data = doc.exists ? doc.data() : {};
      ["phoneDisplay", "whatsapp", "email", "facebook", "tiktok", "instagram"].forEach(function (key) {
        var el = $("#f_" + key);
        if (el) el.value = data[key] || "";
      });
    });

    $("#siteForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var data = {};
      ["phoneDisplay", "whatsapp", "email", "facebook", "tiktok", "instagram"].forEach(function (key) {
        data[key] = $("#f_" + key).value.trim();
      });
      db.doc("site/contact").set(data, { merge: true })
        .then(function () { toast("تم حفظ بيانات التواصل"); })
        .catch(function (err) { toast("خطأ: " + err.message); });
    });
  }

  init();
})();
