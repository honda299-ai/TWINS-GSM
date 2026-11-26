/* TWINS GSM — Quick control panel: one page, full site control */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var PRIMARY = "hondastore299@gmail.com";

  var auth = null, db = null, storage = null, isPrimary = false, toastTimer = null;

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
    toastTimer = setTimeout(function () { el.hidden = true; }, 3600);
  }

  function showError(msg) {
    var el = $("#loginError");
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
  }

  function friendlyLoginError(err) {
    var code = (err && err.code) ? String(err.code) : "";
    var map = {
      "auth/invalid-credential": "الإيميل أو كلمة المرور غلط. لو غيّرت الباسورد، جرّب الجديد.",
      "auth/wrong-password": "كلمة المرور غلط.",
      "auth/user-not-found": "مفيش حساب بالايميل ده في Firebase Authentication.",
      "auth/user-disabled": "الحساب ده معطّل من Firebase Console.",
      "auth/too-many-requests": "محاولات كثيرة جداً — الحساب مقفول مؤقتاً. استنى دقائق أو أعد تعيين الباسورد.",
      "auth/network-request-failed": "مش قادر أوصل بـ Firebase — تأكد من الإنترنت ومن الدومين المصرح به.",
      "auth/unauthorized-domain": "الدومين ده مش مضاف في Firebase → Authentication → Settings → Authorized Domains.",
      "auth/web-storage-unsupported": "المتصفح بيمنع تخزين Firebase. افتح الموقع من رابط حقيقي (مش ملف محلي).",
      "auth/invalid-api-key": "إعدادات firebase-config.js غلط أو المشروع اتقفل.",
      "auth/operation-not-allowed": "الدخول بالإيميل والباسورد مش مفعّل في Firebase Authentication.",
      "auth/timeout": "الطلب استغرق أكتر من 15 ثانية ومفيش رد — غالباً الدومين مش مصرّح أو الشبكة محجوبة."
    };
    return map[code] || (err && err.message ? err.message : "خطأ غير متوقع. حاول تاني.");
  }

  function setLoginBusy(busy) {
    var btn = $("#loginBtn");
    if (!btn) return;
    btn.disabled = !!busy;
    btn.textContent = busy ? "جاري الدخول…" : "دخول ←";
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () {
          var e = new Error("timeout");
          e.code = "auth/timeout";
          reject(e);
        }, ms || 15000);
      })
    ]);
  }

  function fillDiag() {
    var el = $("#loginDiag");
    if (!el) return;
    var cfg = window.TWINS_FIREBASE_CONFIG || {};
    var where = location.host || "ملف محلي (file://) — الدخول مش هيشتغل من هنا";
    el.textContent = "المشروع: " + (cfg.projectId || "—") + " · الرابط: " + where;
  }

  function safeName(name) {
    return String(name || "file").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "file";
  }

  function uploadFile(file, dir) {
    if (!storage) return Promise.reject(new Error("Firebase Storage غير مفعّل — الصق رابط الملف بدلاً من الرفع."));
    var ref = storage.ref().child(dir + "/" + Date.now() + "-" + safeName(file.name));
    return ref.put(file).then(function () { return ref.getDownloadURL(); });
  }

  /* ---------------- Sections ---------------- */

  var SECTIONS = [
    {
      id: "works", title: "الصور والأعمال", icon: "🖼",
      desc: "الصورة اللي بتظهر في معرض الأعمال مع الموديل والوصف.",
      imageKey: "image",
      titleFn: function (d) { return d.model || "جهاز بدون اسم"; },
      subFn: function (d) { return (d.brand || "—") + " · " + (d.desc || ""); },
      fields: [
        { key: "brand", label: "البراند", type: "text", required: true },
        { key: "model", label: "الموديل", type: "text", required: true },
        { key: "category", label: "التصنيف", type: "select", options: ["iphone", "samsung", "xiaomi", "tablet", "other"] },
        { key: "image", label: "صورة العمل", type: "image", full: true, hint: "الصق رابط صورة أو ارفع صورة من جهازك." },
        { key: "desc", label: "الوصف", type: "textarea", full: true },
        { key: "order", label: "الترتيب", type: "number" }
      ]
    },
    {
      id: "tools", title: "الأدوات والتحميلات", icon: "⬇",
      desc: "أسماء الأدوات وملفات التحميل. اكتب مسار الملف أو ارفع ZIP.",
      fileKey: "file",
      titleFn: function (d) { return d.name || "أداة بدون اسم"; },
      subFn: function (d) { return (d.tag || d.category || "—") + " · " + (d.version || "v1.0") + " · " + (d.size || "—"); },
      fields: [
        { key: "name", label: "اسم الأداة", type: "text", required: true, full: true },
        { key: "desc", label: "الوصف", type: "textarea", full: true },
        { key: "category", label: "التصنيف", type: "select", options: ["frp", "network", "flash"] },
        { key: "tag", label: "الوسم الظاهر", type: "text" },
        { key: "version", label: "الإصدار", type: "text" },
        { key: "size", label: "الحجم", type: "text" },
        { key: "file", label: "ملف التحميل", type: "file", full: true, hint: "مثال: tools/twins-flash-guide.zip أو رابط مباشر." },
        { key: "order", label: "الترتيب", type: "number" },
        { key: "hot", label: "أداة مميزة", type: "checkbox" }
      ]
    },
    {
      id: "services", title: "الخدمات والأسعار", icon: "⚙",
      desc: "البطاقات والأسعار اللي بتظهر للأعضاء المسجلين.",
      titleFn: function (d) { return d.title || "خدمة بدون اسم"; },
      subFn: function (d) { return (d.price ? d.price + " · " : "") + (d.desc || ""); },
      fields: [
        { key: "title", label: "عنوان الخدمة", type: "text", required: true },
        { key: "tag", label: "النوع ", type: "text" },
        { key: "icon", label: "الأيقونة", type: "select", options: ["bolt", "lock", "globe", "signal", "laptop", "shield"] },
        { key: "desc", label: "الوصف", type: "textarea", full: true, required: true },
        { key: "price", label: "السعر", type: "text" },
        { key: "priceNote", label: "ملاحظة السعر", type: "text" },
        { key: "order", label: "الترتيب", type: "number" }
      ]
    },
    {
      id: "stats", title: "إحصائيات الموقع", icon: "📊",
      desc: "الأرقام تحت قسم البداية زي عدد الأجهزة.",
      titleFn: function (d) { return d.value || "—"; },
      subFn: function (d) { return d.label || ""; },
      fields: [
        { key: "value", label: "القيمة", type: "text", required: true },
        { key: "label", label: "الوصف", type: "text", required: true },
        { key: "order", label: "الترتيب", type: "number" }
      ]
    },
    {
      id: "steps", title: "خطوات العمل", icon: "🧭",
      desc: "الخطوات الثلاث اللي بتظهر في صفحة الموقع.",
      titleFn: function (d) { return d.title || "خطوة"; },
      subFn: function (d) { return d.desc || ""; },
      fields: [
        { key: "title", label: "العنوان", type: "text", required: true },
        { key: "desc", label: "الوصف", type: "textarea", full: true },
        { key: "order", label: "الترتيب", type: "number" }
      ]
    },
    {
      id: "testimonials", title: "آراء العملاء", icon: "⭐",
      desc: "آراء العملاء اللي بتظهر في الموقع.",
      titleFn: function (d) { return d.name || "عميل"; },
      subFn: function (d) { return d.text || ""; },
      fields: [
        { key: "name", label: "الاسم", type: "text", required: true },
        { key: "role", label: "الوصف", type: "text" },
        { key: "text", label: "الرأي", type: "textarea", full: true, required: true },
        { key: "order", label: "الترتيب", type: "number" }
      ]
    },
    {
      id: "faqs", title: "الأسئلة الشائعة", icon: "❓",
      desc: "الأسئلة والأجوبة في آخر الصفحة.",
      titleFn: function (d) { return d.q || "سؤال بدون عنوان"; },
      subFn: function (d) { return d.a || ""; },
      fields: [
        { key: "q", label: "السؤال", type: "text", required: true, full: true },
        { key: "a", label: "الإجابة", type: "textarea", full: true, required: true },
        { key: "order", label: "الترتيب", type: "number" }
      ]
    },
    {
      id: "toolCategories", title: "تصنيفات الأدوات", icon: "🏷",
      desc: "فلتر البحث في قسم الأدوات.",
      titleFn: function (d) { return d.label || "—"; },
      subFn: function (d) { return "id: " + (d.id || "—"); },
      fields: [
        { key: "label", label: "الاسم الظاهر", type: "text", required: true },
        { key: "id", label: "المعرّف", type: "text", required: true },
        { key: "order", label: "الترتيب", type: "number" }
      ]
    },
    {
      id: "workCategories", title: "تصنيفات الأعمال", icon: "🏷",
      desc: "فلتر معرض الأعمال.",
      titleFn: function (d) { return d.label || "—"; },
      subFn: function (d) { return "id: " + (d.id || "—"); },
      fields: [
        { key: "label", label: "الاسم الظاهر", type: "text", required: true },
        { key: "id", label: "المعرّف", type: "text", required: true },
        { key: "order", label: "الترتيب", type: "number" }
      ]
    },
    { id: "site", title: "بيانات التواصل", icon: "✆", desc: "رقم واتساب والإيميل والروابط.", special: true },
    { id: "requests", title: "طلبات العملاء", icon: "📥", desc: "تابع الطلبات وغيّر حالتها.", special: true },
    { id: "users", title: "الأعضاء المسجلين", icon: "👥", desc: "كل من عمل حساب (للقراءة فقط).", special: true },
    { id: "downloads", title: "سجل التحميلات", icon: "📈", desc: "آخر التحميلات (للقراءة فقط).", special: true },
    { id: "admins", title: "الشركاء / الأدمنز", icon: "🔑", desc: "إضافة شركاء جدد — للأدمن الأساسي فقط.", special: true }
  ];

  /* ---------------- Forms ---------------- */

  function fieldHtml(f, value) {
    var v = value == null ? "" : value;
    var cls = "ctrl-field" + (f.full ? " full" : "") + (f.type === "checkbox" ? " checkbox" : "");
    var html = '<div class="' + cls + '">';

    if (f.type === "checkbox") {
      html += '<input type="checkbox" id="f_' + f.key + '" ' + (v === true ? "checked" : "") + ' />';
      html += '<label for="f_' + f.key + '">' + esc(f.label) + '</label>';
    } else if (f.type === "textarea") {
      html += '<label for="f_' + f.key + '">' + esc(f.label) + (f.required ? " *" : "") + '</label>';
      html += '<textarea id="f_' + f.key + '" ' + (f.required ? "required" : "") + '>' + esc(v) + '</textarea>';
    } else if (f.type === "select") {
      html += '<label for="f_' + f.key + '">' + esc(f.label) + '</label><select id="f_' + f.key + '">';
      (f.options || []).forEach(function (o) {
        html += '<option value="' + esc(o) + '" ' + (v === o ? "selected" : "") + '>' + esc(o) + '</option>';
      });
      html += '</select>';
    } else if (f.type === "image" || f.type === "file") {
      var accept = f.type === "image" ? "image/*" : ".zip,.rar,.7z,.pdf,.exe,.apk,.txt";
      html += '<label for="f_' + f.key + '">' + esc(f.label) + '</label>';
      html += '<div class="ctrl-file-row"><input type="text" id="f_' + f.key + '" value="' + esc(v) + '" placeholder="رابط أو مسار الملف" />';
      html += '<input type="file" id="f_' + f.key + '_file" accept="' + accept + '" /></div>';
      html += '<span class="hint">' + esc(f.hint || (f.type === "image" ? "الصق رابط أو ارفع صورة." : "الصق رابط أو ارفع ملف.")) + '</span>';
    } else {
      html += '<label for="f_' + f.key + '">' + esc(f.label) + (f.required ? " *" : "") + '</label>';
      html += '<input type="' + (f.type === "number" ? "number" : "text") + '" id="f_' + f.key + '" value="' + esc(v) + '" ' + (f.required ? "required" : "") + ' />';
    }
    return html + '</div>';
  }

  function formHtml(sec, doc) {
    var html = '<form class="ctrl-form" id="form-' + sec.id + '" hidden>';
    html += '<h3>' + (doc ? "تعديل: " + esc(sec.titleFn(doc)) : "إضافة جديدة في «" + esc(sec.title) + "»") + '</h3>';
    html += '<div class="ctrl-grid">';
    sec.fields.forEach(function (f) {
      html += fieldHtml(f, doc ? doc[f.key] : (f.type === "number" ? 0 : (f.type === "checkbox" ? false : "")));
    });
    html += '</div><div class="ctrl-actions"><button class="btn btn-primary" type="submit">حفظ</button>';
    html += '<button class="btn btn-ghost" type="button" data-cancel="' + sec.id + '">إلغاء</button></div></form>';
    return html;
  }

  function collectData(sec, form) {
    var tasks = [];
    var data = {};

    sec.fields.forEach(function (f) {
      var el = $("#f_" + f.key, form);
      if (!el) return;

      if (f.type === "checkbox") { data[f.key] = el.checked; return; }
      if (f.type === "number") { data[f.key] = Number(el.value || 0); return; }
      if (f.type === "image" || f.type === "file") {
        var url = String(el.value || "").trim();
        var fileInput = $("#f_" + f.key + "_file", form);
        var file = fileInput && fileInput.files && fileInput.files[0];
        if (file) {
          tasks.push(uploadFile(file, f.type === "image" ? "works" : "tools").then(function (u) {
            data[f.key] = u;
            if (sec.id === "tools" && f.key === "file" && (!data.size || data.size === "—")) {
              data.size = Math.max(1, Math.round(file.size / 1024 / 1024)) + " MB";
            }
          }));
        } else {
          data[f.key] = url || "#";
        }
        return;
      }
      data[f.key] = String(el.value || "").trim();
    });

    return Promise.all(tasks).then(function () { return data; });
  }

  /* ---------------- Collection rendering ---------------- */

  function renderCollection(sec) {
    var host = $("#sec-" + sec.id);
    if (!host) return;
    var list = $("#list-" + sec.id, host);

    db.collection(sec.id).get().then(function (snap) {
      var docs = snap.docs.map(function (d) {
        var x = d.data() || {};
        x._id = d.id;
        if (typeof x.order !== "number") x.order = 999;
        return x;
      }).sort(function (a, b) { return a.order - b.order; });

      if (!docs.length) {
        list.innerHTML = '<div class="ctrl-empty">مفيش عناصر هنا لسه — اضغط «+ إضافة».</div>';
        return;
      }

      list.innerHTML = docs.map(function (d) {
        var thumb = "";
        if (sec.imageKey && d[sec.imageKey] && d[sec.imageKey] !== "#") {
          thumb = '<img class="thumb" src="' + esc(d[sec.imageKey]) + '" alt="" onerror="this.style.display=\'none\'" />';
        }
        var fileLink = "";
        if (sec.fileKey && d[sec.fileKey] && d[sec.fileKey] !== "#") {
          fileLink = ' <a href="' + esc(d[sec.fileKey]) + '" target="_blank" rel="noopener">فتح الملف ↗</a>';
        }
        return '<div class="ctrl-row">' + thumb +
          '<div class="main"><b>' + esc(sec.titleFn(d)) + '</b><small>' + esc(sec.subFn(d)) + fileLink + '</small></div>' +
          '<div class="btns"><button type="button" class="icon-btn" data-edit="' + esc(d._id) + '" title="تعديل">✎</button>' +
          '<button type="button" class="icon-btn danger" data-delete="' + esc(d._id) + '" title="حذف">🗑</button></div></div>';
      }).join("");

      $$("[data-edit]", list).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var doc = docs.filter(function (d) { return d._id === btn.getAttribute("data-edit"); })[0];
          var form = $("#form-" + sec.id, host);
          form.innerHTML = formHtml(sec, doc).replace(/^<form[^>]*>|<\/form>$/g, "");
          form.dataset.id = doc._id;
          form.hidden = false;
          form.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      });

      $$("[data-delete]", list).forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (!confirm("متأكد إنك عايز تمسح العنصر ده؟")) return;
          db.collection(sec.id).doc(btn.getAttribute("data-delete")).delete().then(function () {
            toast("تم الحذف");
            renderCollection(sec);
          }).catch(function (e) { toast("خطأ في الحذف: " + e.message); });
        });
      });
    }).catch(function (e) {
      list.innerHTML = '<div class="ctrl-empty">تعذر تحميل البيانات: ' + esc(e.message) + '</div>';
    });
  }

  /* ---------------- Special sections ---------------- */

  function renderSite() {
    var host = $("#sec-site");
    var list = $("#list-site", host);
    var keys = ["phoneDisplay", "whatsapp", "email", "facebook", "tiktok", "instagram"];
    var labels = { phoneDisplay: "الرقم الظاهر", whatsapp: "رابط واتساب", email: "الإيميل", facebook: "فيسبوك", tiktok: "تيك توك", instagram: "إنستغرام" };
    var form = $("#form-site", host);
    form.innerHTML = '<h3>تعديل بيانات التواصل</h3><div class="ctrl-grid">' +
      keys.map(function (k) {
        return '<div class="ctrl-field' + (k === "whatsapp" ? " full" : "") + '"><label>' + labels[k] + '</label><input type="text" id="f_' + k + '" /></div>';
      }).join("") + '</div><div class="ctrl-actions"><button class="btn btn-primary" type="submit">حفظ</button></div>';
    form.hidden = false;

    db.doc("site/contact").get().then(function (doc) {
      var data = doc.exists ? (doc.data() || {}) : {};
      keys.forEach(function (k) { var el = $("#f_" + k, form); if (el) el.value = data[k] || ""; });
    });

    form.onsubmit = function (e) {
      e.preventDefault();
      var data = {};
      keys.forEach(function (k) { data[k] = $("#f_" + k, form).value.trim(); });
      db.doc("site/contact").set(data, { merge: true })
        .then(function () { toast("تم حفظ بيانات التواصل"); renderSite(); })
        .catch(function (err) { toast("خطأ: " + err.message); });
    };

    list.innerHTML = '<div class="ctrl-empty">بيانات التواصل بتظهر في الهيدر والفوتر وصفحة التواصل.</div>';
  }

  function fmt(ts) {
    if (!ts) return "—";
    try { return ts.toDate ? ts.toDate().toLocaleString("ar-EG") : new Date(ts).toLocaleString("ar-EG"); }
    catch (e) { return "—"; }
  }

  function renderRequests() {
    var list = $("#list-requests", $("#sec-requests"));
    $("#form-requests", $("#sec-requests")).hidden = true;
    db.collection("requests").orderBy("createdAt", "desc").get().then(function (snap) {
      if (!snap.size) { list.innerHTML = '<div class="ctrl-empty">مفيش طلبات لسه.</div>'; return; }
      list.innerHTML = snap.docs.map(function (d) {
        var r = d.data() || {};
        var st = r.status || "جديد";
        return '<div class="ctrl-row"><div class="main"><b>' + esc(r.device || "جهاز") + ' — ' + esc(r.service || "خدمة") + '</b>' +
          '<small>' + esc(r.email || "—") + ' · ' + esc(r.note || "") + ' · ' + fmt(r.createdAt) + '</small></div>' +
          '<div class="btns">' + ["جديد", "قيد التنفيذ", "تم التنفيذ"].map(function (s) {
            return '<button type="button" class="icon-btn' + (st === s ? ' active' : '') + '" data-status="' + esc(d.id) + '" data-value="' + s + '" title="' + s + '">' +
              (s === "جديد" ? "↺" : s === "قيد التنفيذ" ? "◷" : "✓") + '</button>';
          }).join("") + '</div></div>';
      }).join("");

      $$("[data-status]", list).forEach(function (btn) {
        btn.addEventListener("click", function () {
          db.collection("requests").doc(btn.getAttribute("data-status"))
            .update({ status: btn.getAttribute("data-value") })
            .then(function () { toast("تم تحديث الحالة"); renderRequests(); })
            .catch(function (e) { toast("خطأ: " + e.message); });
        });
      });
    }).catch(function (e) { list.innerHTML = '<div class="ctrl-empty">خطأ: ' + esc(e.message) + '</div>'; });
  }

  function renderReadOnly(id, fields) {
    var list = $("#list-" + id, $("#sec-" + id));
    $("#form-" + id, $("#sec-" + id)).hidden = true;
    db.collection(id).orderBy("createdAt", "desc").limit(100).get().then(function (snap) {
      if (!snap.size) { list.innerHTML = '<div class="ctrl-empty">لسه مفيش بيانات.</div>'; return; }
      list.innerHTML = snap.docs.map(function (d) {
        var r = d.data() || {};
        var main = fields.map(function (f) { return r[f]; }).filter(Boolean).map(esc).join(" · ") || "—";
        return '<div class="ctrl-row"><div class="main"><b>' + esc(main) + '</b><small>' + fmt(r.createdAt) + '</small></div></div>';
      }).join("");
    }).catch(function () {
      list.innerHTML = '<div class="ctrl-empty">تعذر التحميل. لو ظهر خطأ فهرس، اعمل Index في Firestore.</div>';
    });
  }

  function renderAdmins() {
    var host = $("#sec-admins");
    var list = $("#list-admins", host);
    var form = $("#form-admins", host);
    form.innerHTML = isPrimary
      ? '<h3>إضافة شريك</h3><div class="ctrl-grid"><div class="ctrl-field"><label>إيميل الشريك</label><input type="text" id="f_email" /></div>' +
        '<div class="ctrl-field"><label>الاسم</label><input type="text" id="f_name" /></div></div>' +
        '<div class="ctrl-actions"><button class="btn btn-primary" type="submit">إضافة / تحديث</button></div>'
      : '<h3>الصلاحية</h3><p class="ctrl-empty">إضافة الشركاء للأدمن الأساسي فقط.</p>';
    form.hidden = false;

    if (isPrimary) {
      form.onsubmit = function (e) {
        e.preventDefault();
        var email = $("#f_email", form).value.trim().toLowerCase();
        if (!email) return;
        db.collection("admins").doc(email).set({
          email: email,
          name: $("#f_name", form).value.trim() || email.split("@")[0],
          active: true,
          addedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).then(function () { toast("تمت إضافة الشريك"); renderAdmins(); })
          .catch(function (err) { toast("خطأ: " + err.message); });
      };
    }

    db.collection("admins").get().then(function (snap) {
      var docs = snap.docs.map(function (d) { var x = d.data() || {}; x._id = d.id; return x; });
      list.innerHTML = docs.map(function (d) {
        var main = d._id === PRIMARY;
        return '<div class="ctrl-row"><div class="main"><b>' + esc(d.name || d._id) + (main ? " 👑" : "") + '</b>' +
          '<small>' + esc(d._id) + ' · ' + (d.active === false ? "معطّل" : "نشط") + '</small></div>' +
          '<div class="btns">' + (!main && isPrimary ? '<button type="button" class="icon-btn danger" data-remove="' + esc(d._id) + '" title="إزالة">🗑</button>' : "") + '</div></div>';
      }).join("") || '<div class="ctrl-empty">لسه مفيش شركاء.</div>';

      $$("[data-remove]", list).forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (!confirm("متأكد إنك عايز تشيل الشريك ده؟")) return;
          db.collection("admins").doc(btn.getAttribute("data-remove")).delete()
            .then(function () { toast("تمت الإزالة"); renderAdmins(); })
            .catch(function (e) { toast("خطأ: " + e.message); });
        });
      });
    }).catch(function () { list.innerHTML = '<div class="ctrl-empty">تعذر تحميل الشركاء.</div>'; });
  }

  /* ---------------- Build panel ---------------- */

  function buildPanel() {
    var nav = $("#ctrlNav");
    var host = $("#sectionHost");

    nav.innerHTML = SECTIONS.map(function (s) {
      return '<button type="button" data-goto="' + s.id + '"><span aria-hidden="true">' + s.icon + '</span><span>' + esc(s.title) + '</span></button>';
    }).join("");

    host.innerHTML = SECTIONS.map(function (s) {
      var form = s.special || s.id === "admins" ? '<form class="ctrl-form" id="form-' + s.id + '" hidden></form>'
        : formHtml(s, null);
      return '<section class="ctrl-section" id="sec-' + s.id + '">' +
        '<div class="ctrl-head"><div><h2><span class="icon">' + s.icon + '</span>' + esc(s.title) + '</h2><p>' + esc(s.desc) + '</p></div>' +
        (s.special ? "" : '<button class="btn btn-primary btn-sm" type="button" data-add="' + s.id + '">+ إضافة</button>') +
        '</div>' + form + '<div class="ctrl-list" id="list-' + s.id + '"><div class="ctrl-empty">جاري التحميل…</div></div></section>';
    }).join("");

    SECTIONS.forEach(function (s) {
      if (s.special) return;
      var hostSection = $("#sec-" + s.id);
      var form = $("#form-" + s.id, hostSection);

      $('[data-add="' + s.id + '"]', hostSection).addEventListener("click", function () {
        form.innerHTML = formHtml(s, null).replace(/^<form[^>]*>|<\/form>$/g, "");
        form.dataset.id = "";
        form.hidden = false;
        form.scrollIntoView({ behavior: "smooth", block: "center" });
      });

      $('[data-cancel="' + s.id + '"]', hostSection).addEventListener("click", function () { form.hidden = true; });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var id = form.dataset.id || "";
        var btn = $('button[type="submit"]', form);
        if (btn) btn.disabled = true;

        collectData(s, form).then(function (data) {
          if (s.id === "tools" && !data.file) data.file = "#";
          var task = id ? db.collection(s.id).doc(id).set(data, { merge: true }) : db.collection(s.id).add(data);
          return task;
        }).then(function () {
          toast(id ? "تم حفظ التعديلات" : "تمت الإضافة بنجاح");
          form.hidden = true;
          renderCollection(s);
        }).catch(function (err) {
          toast("خطأ: " + (err && err.message ? err.message : err));
        }).then(function () { if (btn) btn.disabled = false; });
      });

      renderCollection(s);
    });

    renderSite();
    renderRequests();
    renderReadOnly("users", ["name", "email", "role"]);
    renderReadOnly("downloads", ["toolName", "email"]);
    renderAdmins();

    nav.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-goto]");
      if (!btn) return;
      $$(".ctrl-section").forEach(function (el) { el.classList.remove("is-target"); });
      var target = $("#sec-" + btn.getAttribute("data-goto"));
      if (target) { target.classList.add("is-target"); target.scrollIntoView({ behavior: "smooth", block: "start" }); }
      document.body.classList.remove("admin-menu-open");
    });
  }

  /* ---------------- Auth ---------------- */

  function checkAdmin(user) {
    var email = (user.email || "").toLowerCase();
    isPrimary = email === PRIMARY;
    if (isPrimary) return Promise.resolve(true);
    return db.collection("admins").doc(email).get().then(function (d) {
      return d.exists && d.data().active !== false;
    }).catch(function () { return false; });
  }

  function bindLogin() {
    fillDiag();

    $("#pwToggle").addEventListener("click", function () {
      var input = $("#loginPassword");
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      this.textContent = show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور";
      this.setAttribute("aria-pressed", String(show));
      input.focus();
    });

    $("#loginForm").addEventListener("submit", function (e) {
      e.preventDefault();
      showError("");
      setLoginBusy(true);
      var task = withTimeout(auth.signInWithEmailAndPassword(
        $("#loginEmail").value.trim(), $("#loginPassword").value), 15000);
      task.catch(function (err) {
        showError(friendlyLoginError(err) + "  (" + ((err && err.code) || "unknown") + ")");
      }).then(function () { setLoginBusy(false); });
    });

    $("#logoutBtn").addEventListener("click", function () { auth.signOut(); });
    $("#menuToggle").addEventListener("click", function () {
      var open = document.body.classList.toggle("admin-menu-open");
      $("#menuToggle").setAttribute("aria-expanded", String(open));
    });
  }

  function init() {
    bindLogin();

    if (!window.firebase || !window.TWINS_FIREBASE_CONFIG) {
      showError("Firebase مش محمّل — تأكد من الاتصال بالإنترنت.");
      return;
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.TWINS_FIREBASE_CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
      storage = firebase.storage ? firebase.storage() : null;
    } catch (e) {
      showError("خطأ في إعداد Firebase: " + (e && e.message ? e.message : e));
      return;
    }

    auth.onAuthStateChanged(function (user) {
      if (!user) {
        $("#loginView").hidden = false;
        $("#panelView").hidden = true;
        setLoginBusy(false);
        return;
      }
      checkAdmin(user).then(function (allowed) {
        if (!allowed) {
          auth.signOut();
          showError("هذا الحساب ليس لديه صلاحية أدمن. ضيفه من قسم «الشركاء / الأدمنز» في اللوحة الكاملة.");
          return;
        }
        $("#loginView").hidden = true;
        $("#panelView").hidden = false;
        $("#userEmail").textContent = (isPrimary ? "👑 Honda Store · " : "") + (user.email || "");
        buildPanel();
      }).catch(function (err) { showError(friendlyLoginError(err)); });
    }, function (err) {
      showError(friendlyLoginError(err));
      setLoginBusy(false);
    });
  }

  init();
})();
