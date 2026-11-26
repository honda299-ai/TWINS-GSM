/* TWINS GSM — Admin: overview, customers, partners, backup */
(function (A) {
  "use strict";
  var $ = A.$, $$ = A.$$, esc = A.esc;
  var D = window.TWINS_DATA || {};
  var STATUSES = ["جديد", "قيد التنفيذ", "تم التنفيذ"];

  function docsOf(snap) { return snap.docs.map(function (d) { var x = d.data() || {}; x._id = d.id; return x; }); }
  function ms(ts) { try { return ts && ts.toDate ? ts.toDate().getTime() : (ts ? new Date(ts).getTime() : 0); } catch (e) { return 0; } }
  function byNewest(a, b) { return ms(b.createdAt) - ms(a.createdAt); }
  function statusPill(s) { return '<span class="pill ' + (s === "تم التنفيذ" ? "ok" : (s === "قيد التنفيذ" ? "warn" : "new")) + '">' + esc(s || "جديد") + '</span>'; }
  function fail(root, e) { root.innerHTML = '<div class="empty-state">' + esc(A.errMsg(e)) + '</div>'; }

  /* ---------------- Overview ---------------- */

  A.views.overview = function (root) {
    var names = ["tools", "works", "services", "testimonials", "faqs", "stats", "steps", "workCategories", "toolCategories", "requests", "users", "downloads"];
    Promise.all(names.map(function (n) { return A.col(n).get().then(docsOf).catch(function () { return []; }); })
      .concat([A.db.doc("site/settings").get(), A.db.doc("site/contact").get()])).then(function (r) {
      var data = {}; names.forEach(function (n, i) { data[n] = r[i]; });
      var S = r[names.length].exists ? r[names.length].data() : {};
      var C = r[names.length + 1].exists ? r[names.length + 1].data() : null;

      var cards = [["tools", "الأدوات", "⬇"], ["works", "الأعمال", "🖼"], ["services", "الخدمات", "⚙"], ["testimonials", "الآراء", "⭐"], ["requests", "الطلبات", "📥"], ["users", "الأعضاء", "👥"], ["downloads", "التحميلات", "📈"], ["faqs", "الأسئلة", "❓"]];

      var newReq = data.requests.filter(function (x) { return !x.status || x.status === "جديد"; }).length;
      var unseeded = A.SEED_NAMES.filter(function (n) { return !data[n].length && D[n] && D[n].length; });
      var noImg = data.works.filter(function (w) { return !w.image; }).length;
      var noFile = data.tools.filter(function (t) { return !t.file || t.file === "#"; }).length;
      var contactDone = C && C.whatsapp && !/20100000000/.test(C.whatsapp) && C.phoneDisplay && !/100 000 0000/.test(C.phoneDisplay);

      var checks = [
        { ok: contactDone, t: "بيانات التواصل الحقيقية", d: contactDone ? "رقم الواتساب والإيميل متسجلين." : "رقم الواتساب لسه الرقم التجريبي — الزباين مش هيقدروا يوصلوا لك.", go: "settings" },
        { ok: !unseeded.length, t: "المحتوى قابل للتعديل", d: unseeded.length ? "في " + unseeded.length + " أقسام لسه جاية من الملفات الافتراضية ومش ظاهرة للتعديل هنا." : "كل الأقسام متخزنة في قاعدة البيانات.", act: unseeded.length ? "seed" : "" },
        { ok: !!S.logo, t: "شعار الموقع", d: S.logo ? "الشعار مرفوع." : "ارفع شعارك بدل الشعار الافتراضي.", go: "settings" },
        { ok: !data.works.length || !noImg, t: "صور الأعمال", d: noImg ? noImg + " عمل بدون صورة (بيظهر شكل موبايل افتراضي).": "كل الأعمال ليها صور.", go: "works" },
        { ok: !data.tools.length || !noFile, t: "ملفات الأدوات", d: noFile ? noFile + " أداة بدون ملف (زرها بيظهر «قريباً»)." : "كل الأدوات ليها ملفات.", go: "tools" }
      ];
      var done = checks.filter(function (c) { return c.ok; }).length;

      var dl = {}; data.downloads.forEach(function (d) { dl[d.toolName || "أداة"] = (dl[d.toolName || "أداة"] || 0) + 1; });
      var top = Object.keys(dl).map(function (k) { return [k, dl[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
      var max = top.length ? top[0][1] : 1;
      var latest = data.requests.slice().sort(byNewest).slice(0, 5);

      root.innerHTML =
        '<div class="quick"><button class="btn btn-primary btn-sm" data-go="works">+ إضافة عمل</button><button class="btn btn-ghost btn-sm" data-go="tools">+ إضافة أداة</button><button class="btn btn-ghost btn-sm" data-go="media">⬆ رفع صور</button><button class="btn btn-ghost btn-sm" data-go="settings">🎛 تعديل نصوص الموقع</button></div>' +
        '<div class="overview-grid">' + cards.map(function (c) {
          return '<button type="button" class="ov-card" data-go="' + c[0] + '"><span class="ico">' + c[2] + '</span><b>' + data[c[0]].length + '</b><span>' + c[1] + (c[0] === "requests" && newReq ? " · " + newReq + " جديد" : "") + '</span></button>';
        }).join("") + '</div>' +
        '<div class="ov-cols">' +
          '<div class="box"><h3>جاهزية الموقع <span class="pill ' + (done === checks.length ? "ok" : "warn") + '">' + done + ' من ' + checks.length + '</span></h3>' +
          checks.map(function (c) {
            return '<div class="check ' + (c.ok ? "ok" : "todo") + '"><span class="dot">' + (c.ok ? "✓" : "!") + '</span><div><b>' + esc(c.t) + '</b><small>' + esc(c.d) + '</small></div>' +
              (!c.ok && c.act === "seed" ? '<button class="btn btn-primary btn-sm" data-seedall>استيراد</button>' : (!c.ok && c.go ? '<button class="btn btn-ghost btn-sm" data-go="' + c.go + '">فتح</button>' : "")) + '</div>';
          }).join("") + '</div>' +
          '<div class="box"><h3>الأكثر تحميلاً</h3>' + (top.length ? top.map(function (t) {
            return '<div class="bar-row"><div class="top"><span>' + esc(t[0]) + '</span><b>' + t[1] + '</b></div><div class="track"><i style="width:' + Math.round(t[1] / max * 100) + '%"></i></div></div>';
          }).join("") : '<div class="mini-row"><small>لسه مفيش تحميلات.</small></div>') + '</div>' +
        '</div>' +
        '<div class="box"><h3>آخر الطلبات <button class="link-btn" data-go="requests">عرض الكل ←</button></h3>' + (latest.length ? latest.map(function (q) {
          return '<div class="mini-row"><div><b>' + esc(q.device || "جهاز") + ' — ' + esc(q.service || "خدمة") + '</b><small>' + esc(q.email || "—") + ' · ' + A.fmt(q.createdAt) + '</small></div>' + statusPill(q.status) + '</div>';
        }).join("") : '<div class="mini-row"><small>مفيش طلبات لسه.</small></div>') + '</div>';

      root.addEventListener("click", function (e) {
        var g = e.target.closest("[data-go]"); if (g) { A.go(g.getAttribute("data-go")); return; }
        var s = e.target.closest("[data-seedall]");
        if (s) { s.disabled = true; s.textContent = "جاري…"; A.seed(unseeded, false).then(function (n) { A.toast("تم استيراد " + n + " عنصر"); A.go("overview"); }).catch(function (er) { A.toast(A.errMsg(er), true); }); }
      });
      A.setBadge("requests", newReq);
    }).catch(function (e) { fail(root, e); });
  };

  /* ---------------- Requests ---------------- */

  function csvCell(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }
  function download(name, text, type) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([(type ? "" : "\ufeff") + text], { type: type || "text/csv;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  A.views.requests = function (root) {
    var docs = [], filter = "all", q = "";
    root.innerHTML = '<div class="panel-head"><div><h2>طلبات العملاء</h2><p>تابع طلبات الصيانة وغيّر حالتها، وراسل العميل بالإيميل.</p></div><div class="head-actions"><button class="btn btn-ghost btn-sm" id="csvBtn">⤓ تصدير CSV</button></div></div>' +
      '<div class="toolbar"><div class="chips" id="reqChips"></div><label class="search-box"><span>⌕</span><input type="search" id="reqSearch" placeholder="بحث بالجهاز أو الإيميل…" /></label></div>' +
      '<div class="item-list" id="reqList"><div class="empty-state">جاري التحميل…</div></div>';

    function draw() {
      var counts = { all: docs.length };
      STATUSES.forEach(function (s) { counts[s] = docs.filter(function (d) { return (d.status || "جديد") === s; }).length; });
      $("#reqChips").innerHTML = [["all", "الكل"]].concat(STATUSES.map(function (s) { return [s, s]; })).map(function (c) {
        return '<button type="button" data-f="' + esc(c[0]) + '" class="' + (filter === c[0] ? "active" : "") + '">' + esc(c[1]) + ' (' + counts[c[0]] + ')</button>';
      }).join("");
      var list = docs.filter(function (d) {
        var okS = filter === "all" || (d.status || "جديد") === filter;
        var text = [d.device, d.service, d.email, d.note].join(" ").toLowerCase();
        return okS && (!q || text.indexOf(q) > -1);
      });
      $("#reqList").innerHTML = list.length ? list.map(function (d) {
        var mail = d.email ? "mailto:" + encodeURIComponent(d.email) + "?subject=" + encodeURIComponent("بخصوص طلبك: " + (d.device || "")) : "";
        return '<div class="item-row" data-id="' + esc(d._id) + '"><div class="item-main"><b>' + esc(d.device || "جهاز") + ' — ' + esc(d.service || "خدمة") + ' ' + statusPill(d.status) + '</b>' +
          '<small>' + esc(d.email || "—") + ' · ' + A.fmt(d.createdAt) + '</small>' + (d.note ? '<small style="white-space:normal;color:var(--muted)">' + esc(d.note) + '</small>' : "") + '</div>' +
          '<div class="item-actions"><select class="req-select" data-st>' + STATUSES.map(function (s) { return '<option' + ((d.status || "جديد") === s ? " selected" : "") + '>' + s + '</option>'; }).join("") + '</select>' +
          (mail ? '<a class="icon-btn" href="' + mail + '" title="رد بالإيميل">✉</a>' : "") +
          '<button class="icon-btn danger" data-del title="حذف">🗑</button></div></div>';
      }).join("") : '<div class="empty-state">مفيش طلبات مطابقة.</div>';
    }
    function load() {
      return A.col("requests").get().then(function (s) { docs = docsOf(s).sort(byNewest); draw(); A.setBadge("requests", docs.filter(function (d) { return !d.status || d.status === "جديد"; }).length); }).catch(function (e) { fail($("#reqList").parentNode, e); });
    }
    load();
    $("#reqChips").addEventListener("click", function (e) { var b = e.target.closest("[data-f]"); if (b) { filter = b.getAttribute("data-f"); draw(); } });
    $("#reqSearch").addEventListener("input", function () { q = this.value.trim().toLowerCase(); draw(); });
    $("#reqList").addEventListener("change", function (e) {
      var sel = e.target.closest("[data-st]"); if (!sel) return;
      var id = sel.closest(".item-row").getAttribute("data-id");
      A.col("requests").doc(id).update({ status: sel.value }).then(function () { A.toast("تم تحديث الحالة"); return load(); }).catch(function (er) { A.toast(A.errMsg(er), true); });
    });
    $("#reqList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-del]"); if (!b) return;
      var id = b.closest(".item-row").getAttribute("data-id");
      A.confirm("حذف الطلب؟", "هيتحذف نهائياً من حساب العميل كمان.", { ok: "حذف" }).then(function (ok) {
        if (ok) A.col("requests").doc(id).delete().then(function () { A.toast("تم الحذف"); return load(); }).catch(function (er) { A.toast(A.errMsg(er), true); });
      });
    });
    $("#csvBtn").onclick = function () {
      var rows = [["التاريخ", "الإيميل", "الخدمة", "الجهاز", "الملاحظات", "الحالة"]].concat(docs.map(function (d) { return [A.fmt(d.createdAt), d.email, d.service, d.device, d.note, d.status || "جديد"]; }));
      download("twins-requests-" + new Date().toISOString().slice(0, 10) + ".csv", rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n"));
    };
  };

  /* ---------------- Users ---------------- */

  A.views.users = function (root) {
    root.innerHTML = '<div class="panel-head"><div><h2>الأعضاء المسجلين <span class="pill" id="uCount"></span></h2><p>كل من عمل حساب على الموقع.</p></div></div>' +
      '<div class="toolbar"><label class="search-box"><span>⌕</span><input type="search" id="uSearch" placeholder="بحث بالاسم أو الإيميل…" /></label></div><div class="item-list" id="uList"><div class="empty-state">جاري التحميل…</div></div>';
    var docs = [];
    function draw() {
      var q = $("#uSearch").value.trim().toLowerCase();
      var l = docs.filter(function (u) { return !q || (u.name + " " + u.email).toLowerCase().indexOf(q) > -1; });
      $("#uCount").textContent = docs.length;
      $("#uList").innerHTML = l.length ? l.map(function (u) {
        return '<div class="item-row"><div class="item-thumb">' + esc(String(u.name || u.email || "?").charAt(0).toUpperCase()) + '</div><div class="item-main"><b>' + esc(u.name || u.email || "عضو") + (u.role === "admin" ? ' <span class="pill new">أدمن</span>' : "") + '</b><small>' + esc(u.email || "—") + ' · ' + A.fmt(u.createdAt) + '</small></div></div>';
      }).join("") : '<div class="empty-state">لا يوجد أعضاء.</div>';
    }
    A.col("users").get().then(function (s) { docs = docsOf(s).sort(byNewest); draw(); }).catch(function (e) { fail($("#uList").parentNode, e); });
    $("#uSearch").addEventListener("input", draw);
  };

  /* ---------------- Downloads ---------------- */

  A.views.downloads = function (root) {
    root.innerHTML = '<div class="panel-head"><div><h2>سجل التحميلات</h2><p>آخر الأدوات اللي الأعضاء نزّلوها.</p></div></div><div id="dTop"></div>' +
      '<div class="toolbar"><label class="search-box"><span>⌕</span><input type="search" id="dSearch" placeholder="بحث بالأداة أو الإيميل…" /></label></div><div class="item-list" id="dList"><div class="empty-state">جاري التحميل…</div></div>';
    var docs = [];
    function draw() {
      var q = $("#dSearch").value.trim().toLowerCase();
      var l = docs.filter(function (d) { return !q || ((d.toolName || "") + " " + (d.email || "")).toLowerCase().indexOf(q) > -1; }).slice(0, 150);
      $("#dList").innerHTML = l.length ? l.map(function (d) {
        return '<div class="item-row"><div class="item-main"><b>' + esc(d.toolName || "أداة") + '</b><small>' + esc(d.email || "—") + ' · ' + A.fmt(d.createdAt) + '</small></div></div>';
      }).join("") : '<div class="empty-state">لسه مفيش تحميلات.</div>';
    }
    A.col("downloads").get().then(function (s) {
      docs = docsOf(s).sort(byNewest);
      var g = {}; docs.forEach(function (d) { g[d.toolName || "أداة"] = (g[d.toolName || "أداة"] || 0) + 1; });
      var top = Object.keys(g).map(function (k) { return [k, g[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6), max = top.length ? top[0][1] : 1;
      $("#dTop").innerHTML = top.length ? '<div class="box" style="margin-bottom:18px"><h3>ترتيب الأدوات حسب التحميل (' + docs.length + ' تحميل)</h3>' + top.map(function (t) {
        return '<div class="bar-row"><div class="top"><span>' + esc(t[0]) + '</span><b>' + t[1] + '</b></div><div class="track"><i style="width:' + Math.round(t[1] / max * 100) + '%"></i></div></div>';
      }).join("") + '</div>' : "";
      draw();
    }).catch(function (e) { fail($("#dList").parentNode, e); });
    $("#dSearch").addEventListener("input", draw);
  };

  /* ---------------- Partners ---------------- */

  A.views.admins = function (root) {
    root.innerHTML = '<div class="panel-head"><div><h2>الشركاء / الأدمنز</h2><p>الشريك بيقدر يعدّل كل محتوى الموقع، لكن الأدمن الأساسي بس هو اللي يضيف أو يشيل الشركاء.</p></div></div>' +
      (A.isPrimary ? '<form class="form-card" id="partnerForm"><h3>إضافة شريك</h3><p class="sub">الشريك لازم يكون عنده حساب على الموقع بنفس الإيميل (من صفحة «حسابي»).</p><div class="form-grid">' +
        '<div class="form-field"><label for="pEmail">إيميل الشريك *</label><input type="text" id="pEmail" dir="ltr" placeholder="partner@example.com" /></div>' +
        '<div class="form-field"><label for="pName">الاسم</label><input type="text" id="pName" /></div></div><div class="form-actions"><button class="btn btn-primary" type="submit">إضافة</button></div></form>'
        : '<div class="pill warn" style="margin-bottom:16px;display:inline-block">إضافة وإزالة الشركاء متاحة للأدمن الأساسي فقط.</div>') +
      '<div class="item-list" id="pList"><div class="empty-state">جاري التحميل…</div></div>';

    function load() {
      A.col("admins").get().then(function (s) {
        var docs = docsOf(s).filter(function (d) { return d._id !== A.PRIMARY; });
        var rows = ['<div class="item-row"><div class="item-thumb">👑</div><div class="item-main"><b>الأدمن الأساسي</b><small>' + esc(A.PRIMARY) + '</small></div></div>'];
        docs.forEach(function (d) {
          rows.push('<div class="item-row' + (d.active === false ? " is-hidden" : "") + '" data-id="' + esc(d._id) + '"><div class="item-thumb">' + esc(String(d.name || d._id).charAt(0).toUpperCase()) + '</div><div class="item-main"><b>' + esc(d.name || d._id) + (d.active === false ? ' <span class="pill warn">موقوف</span>' : ' <span class="pill ok">نشط</span>') + '</b><small>' + esc(d._id) + '</small></div>' +
            (A.isPrimary ? '<div class="item-actions"><button class="icon-btn" data-t title="' + (d.active === false ? "تفعيل" : "إيقاف") + '">' + (d.active === false ? "▶" : "⏸") + '</button><button class="icon-btn danger" data-r title="إزالة">🗑</button></div>' : "") + '</div>');
        });
        $("#pList").innerHTML = rows.join("");
        $("#pList").onclick = function (e) {
          var row = e.target.closest(".item-row"); if (!row || !row.getAttribute("data-id")) return;
          var id = row.getAttribute("data-id"), d = docs.filter(function (x) { return x._id === id; })[0];
          if (e.target.closest("[data-t]")) A.col("admins").doc(id).update({ active: d.active === false }).then(load).catch(function (er) { A.toast(A.errMsg(er), true); });
          else if (e.target.closest("[data-r]")) A.confirm("إزالة الشريك؟", id + " مش هيقدر يدخل اللوحة تاني.", { ok: "إزالة" }).then(function (ok) { if (ok) A.col("admins").doc(id).delete().then(function () { A.toast("تمت الإزالة"); load(); }).catch(function (er) { A.toast(A.errMsg(er), true); }); });
        };
      }).catch(function (e) { fail($("#pList").parentNode, e); });
    }
    load();
    var pf = $("#partnerForm");
    if (pf) pf.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = $("#pEmail").value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { A.toast("اكتب إيميل صحيح.", true); return; }
      A.col("admins").doc(email).set({ email: email, name: $("#pName").value.trim() || email.split("@")[0], active: true, addedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
        .then(function () { A.toast("تمت إضافة الشريك"); pf.reset(); load(); }).catch(function (er) { A.toast(A.errMsg(er), true); });
    });
  };

  /* ---------------- Backup / Import ---------------- */

  A.views.backup = function (root) {
    root.innerHTML = '<div class="panel-head"><div><h2>نسخ احتياطي واستيراد</h2><p>احتفظ بنسخة من كل محتوى الموقع وإعداداته وصوره، أو استرجع نسخة قديمة.</p></div></div>' +
      '<div class="form-card"><h3>⤓ تنزيل نسخة احتياطية</h3><p class="sub">ملف JSON فيه كل الأقسام والإعدادات وبيانات التواصل والصور المرفوعة جوه الأعمال والشعار (من غير بيانات العملاء).</p><button class="btn btn-primary" id="exportBtn">تنزيل النسخة الاحتياطية</button></div>' +
      '<div class="form-card"><h3>⤒ استرجاع من ملف</h3><p class="sub">اختر ملف نسخة احتياطية سبق تنزيله من هنا.</p><div class="form-grid">' +
        '<div class="form-field"><label for="impMode">طريقة الاسترجاع</label><select id="impMode"><option value="replace">استبدال المحتوى الحالي بالكامل</option><option value="add">إضافة فوق الموجود</option></select></div>' +
        '<div class="form-field"><label for="impFile">الملف</label><input type="file" id="impFile" accept="application/json,.json" /></div></div>' +
        '<div class="form-actions"><button class="btn btn-ghost" id="importBtn">بدء الاسترجاع</button></div></div>' +
      '<div class="form-card"><h3>↺ المحتوى الافتراضي (من data.js)</h3><p class="sub">الاستيراد العادي بيملأ الأقسام الفاضية فقط. «الإرجاع للأصل» بيمسح محتواك ويرجّع النسخة الأصلية.</p>' +
        '<div class="form-actions"><button class="btn btn-ghost" id="seedBtn">استيراد للأقسام الفاضية فقط</button><button class="btn btn-danger" id="resetBtn">إرجاع كل المحتوى للأصل</button></div></div>';

    $("#exportBtn").onclick = function () {
      var out = { app: "twins-gsm", version: 2, exportedAt: new Date().toISOString(), collections: {}, site: {} };
      Promise.all(A.SEED_NAMES.map(function (n) { return A.col(n).get().then(function (s) { out.collections[n] = s.docs.map(function (d) { return { id: d.id, data: d.data() }; }); }); })
        .concat(["settings", "contact"].map(function (k) { return A.db.doc("site/" + k).get().then(function (d) { if (d.exists) out.site[k] = d.data(); }); })))
        .then(function () { download("twins-backup-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(out), "application/json"); A.toast("تم تنزيل النسخة"); })
        .catch(function (e) { A.toast(A.errMsg(e), true); });
    };

    $("#importBtn").onclick = function () {
      var f = $("#impFile").files[0]; if (!f) { A.toast("اختار ملف النسخة الأول.", true); return; }
      var replace = $("#impMode").value === "replace";
      f.text().then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { throw new Error("الملف مش JSON صالح."); }
        if (!j || j.app !== "twins-gsm" || !j.collections) throw new Error("الملف ده مش نسخة احتياطية من لوحة TWINS GSM.");
        return A.confirm(replace ? "استبدال المحتوى؟" : "إضافة المحتوى؟", replace ? "هيتمسح محتوى الموقع الحالي ويتحط محتوى النسخة." : "هيتضاف محتوى النسخة فوق الموجود (ممكن يحصل تكرار).", { ok: "متابعة", danger: replace }).then(function (ok) {
          if (!ok) return;
          return Promise.all(A.SEED_NAMES.map(function (n) { return replace ? A.col(n).get() : Promise.resolve(null); })).then(function (snaps) {
            var ops = [];
            A.SEED_NAMES.forEach(function (n, i) {
              if (!j.collections[n]) return;
              if (snaps[i]) snaps[i].docs.forEach(function (d) { ops.push({ type: "delete", ref: d.ref }); });
              j.collections[n].forEach(function (it) { ops.push({ type: "set", ref: replace ? A.col(n).doc(it.id) : A.col(n).doc(), data: it.data }); });
            });
            ["settings", "contact"].forEach(function (k) { if (j.site && j.site[k]) ops.push({ type: "set", merge: !replace, ref: A.db.doc("site/" + k), data: j.site[k] }); });
            return A.batchRun(ops, 20);
          }).then(function () { A.toast("✓ تم الاسترجاع"); });
        });
      }).catch(function (e) { A.toast(e.message || A.errMsg(e), true); });
    };

    $("#seedBtn").onclick = function () {
      Promise.all([A.seed(null, false), A.seedContact()]).then(function (r) { A.toast("تم استيراد " + r[0] + " عنصر"); }).catch(function (e) { A.toast(A.errMsg(e), true); });
    };
    $("#resetBtn").onclick = function () {
      A.confirm("إرجاع كل المحتوى للأصل؟", "هيتمسح كل محتواك (أدوات، أعمال، خدمات، آراء…) وتتحط النسخة الافتراضية. الإعدادات والصور في «إعدادات الموقع» مش هتتأثر.", { ok: "إرجاع للأصل" }).then(function (ok) {
        if (ok) A.seed(null, true).then(function (n) { A.toast("تم إرجاع " + n + " عنصر للأصل"); }).catch(function (e) { A.toast(A.errMsg(e), true); });
      });
    };
  };
})(window.ADM);
