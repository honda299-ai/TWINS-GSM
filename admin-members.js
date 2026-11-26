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
        return '<div class="item-row"><div class="item-thumb">' + esc(String(r.u.name || r.u.email || "?").charAt(0).toUpperCase()) + '</div><div class="item-main"><b>' + esc(r.u.name || r.u.email) + ' <span class="pill ' + r.s.c + '">' + r.s.t + '</span></b><small>' + esc(r.u.email || "—") + (e ? " · ينتهي " + ymd(e) + (r.s.left > 0 ? " (باقي " + r.s.left + " يوم)" : "") : "") + '</small></div><div class="item-actions"><button class="btn btn-ghost btn-sm" data-uid="' + esc(r.u._id) + '">إدارة</button></div></div>';
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
        '<div class="modal-actions"><button class="btn btn-primary" id="mSave" type="button">حفظ</button><button class="btn btn-ghost" id="mCancel" type="button">إلغاء</button></div>');
      $("#mLevel").value = m.level === "pro" ? "pro" : "none"; $("#mActive").checked = m.active !== false; $("#mNote").value = m.note || "";
      $("#modalBox").onclick = function (ev) {
        var a = ev.target.getAttribute && ev.target.getAttribute("data-add");
        if (a) { var cur = $("#mExp").value ? new Date($("#mExp").value) : new Date(); if (cur < new Date()) cur = new Date(); $("#mExp").value = ymd(new Date(cur.getTime() + (+a) * DAY)); $("#mLevel").value = "pro"; }
        if (ev.target.id === "mCancel") A.modal.close();
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
