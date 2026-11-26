/* TWINS GSM — Admin: العملاء والعضويات (PRO) */
(function (A) {
  "use strict";
  var $ = A.$, esc = A.esc, DAY = 864e5;
  function dt(t) { return t && t.toDate ? t.toDate() : (t ? new Date(t) : null); }
  function ymd(d) { return d ? new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) : ""; }
  function status(m) {
    if (!m || m.level !== "pro") return { k: "none", t: "بدون عضوية", c: "new", left: null };
    var e = dt(m.expiresAt), left = e ? Math.ceil((e - Date.now()) / DAY) : -1;
    if (m.active === false) return { k: "off", t: "موقوفة", c: "warn", left: left };
    if (left <= 0) return { k: "expired", t: "منتهية", c: "warn", left: left };
    return { k: left <= 7 ? "soon" : "active", t: left <= 7 ? "تنتهي قريباً" : "PRO نشطة", c: "ok", left: left };
  }

  A.views.members = function (root) {
    root.innerHTML = '<div class="panel-head"><div><h2>العملاء والعضويات</h2><p>تحكم في عضوية PRO لكل عميل ومدتها. بتنتهي لوحدها في موعدها.</p></div></div><div id="mStats"></div>' +
      '<div class="toolbar"><label class="search-box"><span>⌕</span><input type="search" id="mSearch" placeholder="بحث بالاسم أو الإيميل…" /></label>' +
      '<select id="mFilter"><option value="">الكل</option><option value="active">PRO نشطة</option><option value="soon">تنتهي خلال 7 أيام</option><option value="expired">منتهية</option><option value="none">بدون عضوية</option></select></div>' +
      '<div class="item-list" id="mList"><div class="empty-state">جاري التحميل…</div></div>';
    var users = [], mem = {};
    function rows() {
      return users.map(function (u) { return { u: u, m: mem[u._id], s: status(mem[u._id]) }; });
    }
    function draw() {
      var q = $("#mSearch").value.trim().toLowerCase(), f = $("#mFilter").value, all = rows();
      var cnt = function (k) { return all.filter(function (r) { return r.s.k === k; }).length; };
      $("#mStats").innerHTML = '<div class="box" style="margin-bottom:14px;display:flex;gap:22px;flex-wrap:wrap"><span>👥 <b>' + all.length + '</b> عميل</span><span>💎 <b>' + (cnt("active") + cnt("soon")) + '</b> PRO نشطة</span><span>⏳ <b>' + cnt("soon") + '</b> تنتهي قريباً</span><span>⛔ <b>' + cnt("expired") + '</b> منتهية</span></div>';
      var l = all.filter(function (r) { return (!q || ((r.u.name || "") + " " + (r.u.email || "")).toLowerCase().indexOf(q) > -1) && (!f || r.s.k === f); })
        .sort(function (a, b) { return (a.s.left == null ? 9e9 : a.s.left) - (b.s.left == null ? 9e9 : b.s.left); });
      $("#mList").innerHTML = l.length ? l.map(function (r) {
        var e = dt(r.m && r.m.expiresAt);
        return '<div class="item-row"><div class="item-thumb">' + esc(String(r.u.name || r.u.email || "?").charAt(0).toUpperCase()) + '</div><div class="item-main"><b>' + esc(r.u.name || r.u.email) + ' <span class="pill ' + r.s.c + '">' + r.s.t + '</span>' + (r.u.blocked ? ' <span class="pill warn">محظور</span>' : '') + '</b><small>' + esc(r.u.email || "—") + (e ? " · ينتهي " + ymd(e) + (r.s.left > 0 ? " (باقي " + r.s.left + " يوم)" : "") : "") + '</small></div><div class="item-actions"><button class="btn btn-ghost btn-sm" data-uid="' + esc(r.u._id) + '">إدارة</button></div></div>';
      }).join("") : '<div class="empty-state">لا نتائج.</div>';
    }
    function edit(uid) {
      var u = users.filter(function (x) { return x._id === uid; })[0], m = mem[uid] || {}, e = dt(m.expiresAt);
      var box = A.modal.open('<h3>عضوية ' + esc(u.name || u.email) + '</h3><p>' + esc(u.email || "") + '</p>' +
        '<label>المستوى<select id="mLevel"><option value="none">بدون عضوية</option><option value="pro">PRO</option></select></label>' +
        '<label>تاريخ الانتهاء<input type="date" id="mExp" value="' + ymd(e) + '"></label>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0"><button type="button" class="btn btn-ghost btn-sm" data-add="30">+30 يوم</button><button type="button" class="btn btn-ghost btn-sm" data-add="90">+90 يوم</button><button type="button" class="btn btn-ghost btn-sm" data-add="365">+سنة</button></div>' +
        '<label><input type="checkbox" id="mActive"> العضوية مفعّلة</label>' +
        '<label>ملاحظة (خاصة بيك)<textarea id="mNote" rows="2"></textarea></label>' +
        '<div class="danger-zone"><b>إجراءات الحساب</b><div><button type="button" class="btn btn-ghost btn-sm" id="mBlock">' + (u.blocked ? "فك الحظر" : "حظر الحساب") + '</button><button type="button" class="btn btn-ghost btn-sm" id="mReset">إعادة تعيين الباسورد</button><button type="button" class="btn btn-ghost btn-sm" id="mPartner">تعيين كشريك أدمن</button><button type="button" class="btn btn-ghost btn-sm" id="mDelete">حذف الحساب</button></div></div>' +
        '<div class="modal-actions"><button class="btn btn-primary" id="mSave" type="button">حفظ</button><button class="btn btn-ghost" id="mCancel" type="button">إلغاء</button></div>');
      $("#mLevel").value = m.level === "pro" ? "pro" : "none"; $("#mActive").checked = m.active !== false; $("#mNote").value = m.note || "";
      $("#modalBox").onclick = function (ev) {
        var a = ev.target.getAttribute && ev.target.getAttribute("data-add");
        if (a) { var cur = $("#mExp").value ? new Date($("#mExp").value) : new Date(); if (cur < new Date()) cur = new Date(); $("#mExp").value = ymd(new Date(cur.getTime() + (+a) * DAY)); $("#mLevel").value = "pro"; }
        if (ev.target.id === "mCancel") A.modal.close();
        var id = ev.target.id, ts = firebase.firestore.FieldValue.serverTimestamp(), em = (u.email || "").toLowerCase();
        function done(msg) { A.toast(msg); A.modal.close(); load(); }
        function bad(er) { A.toast(A.errMsg(er), true); }
        if (id === "mBlock") {
          var nb = !u.blocked;
          A.col("users").doc(uid).set({ blocked: nb, blockedAt: ts }, { merge: true }).then(function () { return nb ? A.col("memberships").doc(uid).set({ active: false }, { merge: true }) : null; }).then(function () { done(nb ? "تم حظر الحساب" : "تم فك الحظر"); }).catch(bad);
        }
        if (id === "mReset") firebase.auth().sendPasswordResetEmail(u.email).then(function () { A.toast("اتبعت رابط إعادة التعيين"); }).catch(bad);
        if (id === "mPartner") A.confirm("تعيين شريك؟", em + " هيدخل لوحة التحكم (لازم أنت الأدمن الأساسي).", { ok: "تعيين" }).then(function (ok) { if (ok) A.col("admins").doc(em).set({ email: em, active: true, createdAt: ts }).then(function () { A.toast("تم التعيين"); }).catch(bad); });
        if (id === "mDelete") A.confirm("حذف الحساب نهائياً؟", "هتتمسح بيانات " + em + " وطلباته وتحميلاته وعضويته، ويتحظر. (حذف تسجيل الدخول نفسه من Firebase Console ← Authentication).", { ok: "حذف نهائي" }).then(function (ok) {
          if (!ok) return;
          Promise.all([A.col("requests").where("uid", "==", uid).get(), A.col("downloads").where("uid", "==", uid).get()]).then(function (s) {
            var b = A.db.batch(); s.forEach(function (q) { q.docs.forEach(function (d) { b.delete(d.ref); }); });
            b.delete(A.col("memberships").doc(uid)); b.set(A.col("users").doc(uid), { email: u.email || "", name: "", blocked: true, deleted: true, role: "member", createdAt: ts });
            return b.commit();
          }).then(function () { done("تم حذف الحساب"); }).catch(bad);
        });

        if (ev.target.id === "mSave") {
          var lvl = $("#mLevel").value, ex = $("#mExp").value;
          if (lvl === "pro" && !ex) { A.toast("حدد تاريخ الانتهاء.", true); return; }
          var doc = { email: u.email || "", name: u.name || "", level: lvl, active: $("#mActive").checked, note: $("#mNote").value.trim().slice(0, 300), updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
          if (!m.startAt && lvl === "pro") doc.startAt = firebase.firestore.FieldValue.serverTimestamp();
          if (ex) doc.expiresAt = firebase.firestore.Timestamp.fromDate(new Date(ex + "T23:59:59"));
          A.col("memberships").doc(uid).set(doc, { merge: true }).then(function () { A.toast("تم الحفظ"); A.modal.close(); load(); }).catch(function (er) { A.toast(A.errMsg(er), true); });
        }
      };
    }
    function load() {
      Promise.all([A.col("users").get(), A.col("memberships").get()]).then(function (r) {
        users = r[0].docs.map(function (d) { var x = d.data(); x._id = d.id; return x; });
        mem = {}; r[1].docs.forEach(function (d) { mem[d.id] = d.data(); });
        draw();
      }).catch(function (e) { $("#mList").innerHTML = '<div class="empty-state">' + esc(A.errMsg(e)) + '</div>'; });
    }
    $("#mSearch").addEventListener("input", draw); $("#mFilter").addEventListener("change", draw);
    $("#mList").addEventListener("click", function (e) { var b = e.target.closest("[data-uid]"); if (b) edit(b.getAttribute("data-uid")); });
    load();
  };
})(window.ADM);

/* دخول الأدمن بجوجل (إيميل جوجل بيكون متأكَّد تلقائياً) */
(function () {
  var b = document.getElementById("adminGoogle");
  if (!b || !window.firebase) return;
  b.addEventListener("click", function () {
    var e = document.getElementById("loginError");
    firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(function (er) {
      if (e && er.code !== "auth/popup-closed-by-user") { e.textContent = er.code === "auth/operation-not-allowed" ? "فعّل Google من Firebase Console." : "تعذّر الدخول بجوجل."; e.hidden = false; }
    });
  });
})();

/* التعليقات: موافقة / إخفاء / حذف */
(function (A) {
  A.views.comments = function (root) {
    var $ = A.$, esc = A.esc, docs = [];
    root.innerHTML = '<div class="panel-head"><div><h2>التعليقات والموافقة</h2><p>التعليق مابيظهرش للزوار غير بعد موافقتك.</p></div></div><div class="toolbar"><select id="cF"><option value="pending">بانتظار الموافقة</option><option value="approved">المنشورة</option><option value="hidden">المخفية</option><option value="">الكل</option></select></div><div class="item-list" id="cList"><div class="empty-state">جاري التحميل…</div></div>';
    function draw() {
      var f = $("#cF").value, l = docs.filter(function (d) { return !f || (d.status || "pending") === f; });
      $("#cList").innerHTML = l.length ? l.map(function (d) {
        var st = d.status || "pending";
        return '<div class="item-row"><div class="item-main"><b>' + esc(d.name || "عضو") + ' <span class="pill ' + (st === "approved" ? "ok" : st === "hidden" ? "warn" : "new") + '">' + (st === "approved" ? "منشور" : st === "hidden" ? "مخفي" : "بانتظار") + '</span> ' + "★".repeat(d.rating | 0) + '</b><small>' + esc(d.text) + '</small></div><div class="item-actions">' +
          (st !== "approved" ? '<button class="btn btn-primary btn-sm" data-s="approved" data-id="' + d._id + '">قبول</button>' : '<button class="btn btn-ghost btn-sm" data-s="hidden" data-id="' + d._id + '">إخفاء</button>') +
          ' <button class="btn btn-ghost btn-sm" data-x="' + d._id + '">حذف</button></div></div>';
      }).join("") : '<div class="empty-state">لا توجد تعليقات.</div>';
    }
    function load() { A.col("comments").get().then(function (s) { docs = s.docs.map(function (d) { var x = d.data(); x._id = d.id; return x; }).sort(function (a, b) { return (b.createdAt && b.createdAt.seconds || 0) - (a.createdAt && a.createdAt.seconds || 0); }); draw(); }).catch(function (e) { $("#cList").innerHTML = '<div class="empty-state">' + esc(A.errMsg(e)) + '</div>'; }); }
    $("#cF").addEventListener("change", draw);
    $("#cList").addEventListener("click", function (e) {
      var s = e.target.closest("[data-s]"), x = e.target.closest("[data-x]");
      if (s) A.col("comments").doc(s.getAttribute("data-id")).update({ status: s.getAttribute("data-s") }).then(function () { A.toast("تم"); load(); }).catch(function (er) { A.toast(A.errMsg(er), true); });
      if (x) A.confirm("حذف التعليق؟", "هيتمسح نهائياً.", { ok: "حذف" }).then(function (ok) { if (ok) A.col("comments").doc(x.getAttribute("data-x")).delete().then(function () { A.toast("تم الحذف"); load(); }); });
    });
    load();
  };
})(window.ADM);
