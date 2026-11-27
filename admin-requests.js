/* TWINS GSM — Admin: محادثة الطلبات + سجل النشاط */
(function (A) {
  "use strict";
  var $ = A.$, esc = A.esc, ST = ["جديد", "قيد التنفيذ", "تم التنفيذ"];
  var TPL = ["أهلاً بيك 👋 استلمنا طلبك وبنراجعه دلوقتي.", "ممكن توضحلي موديل الجهاز وإصدار النظام والمشكلة بالتفصيل؟", "الخدمة دي بتحتاج إثبات ملكية الجهاز (علبة أو فاتورة). ممكن تبعتهم؟", "تم الانتهاء من طلبك ✅ تقدر تكلمنا لو احتجت أي حاجة."];
  var LABEL = { block: "🚫 حظر حساب", unblock: "✅ فك حظر", delete_user: "🗑 حذف حساب", membership: "💎 عضوية", partner: "👑 تعيين شريك", reply: "💬 رد على طلب", status: "🔄 تغيير حالة طلب", comment: "📝 تعليق", delete_req: "🗑 حذف طلب" };
  function ts() { return firebase.firestore.FieldValue.serverTimestamp(); }
  function sec(d) { return d && d.createdAt && d.createdAt.seconds || 0; }
  function pill(s) { return '<span class="pill ' + (s === "تم التنفيذ" ? "ok" : s === "قيد التنفيذ" ? "warn" : "new") + '">' + esc(s || "جديد") + '</span>'; }
  function csv(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }

  A.log = function (type, target, info) {
    if (!A.user) return Promise.resolve();
    return A.col("activity").add({ by: A.user.email || "", type: type, target: target || "", info: String(info || "").slice(0, 300), createdAt: ts() }).catch(function () {});
  };

  A.views.requests = function (root) {
    var docs = [], filter = "all", q = "", unsub;
    root.innerHTML = '<div class="panel-head"><div><h2>طلبات العملاء</h2><p>رد على العميل جوه الموقع وتابع حالة كل طلب لحظياً.</p></div><div class="head-actions"><button class="btn btn-ghost btn-sm" id="csvBtn" type="button">⤓ تصدير CSV</button></div></div>' +
      '<div class="toolbar"><div class="chips" id="reqChips"></div><label class="search-box"><span>⌕</span><input type="search" id="reqSearch" placeholder="بحث بالجهاز أو الإيميل…" /></label></div>' +
      '<div class="item-list" id="reqList"><div class="empty-state">جاري التحميل…</div></div>';
    function isNew(d) { return !d.status || d.status === "جديد"; }
    function draw() {
      var c = { all: docs.length }; ST.forEach(function (s) { c[s] = docs.filter(function (d) { return (d.status || "جديد") === s; }).length; });
      c.unread = docs.filter(function (d) { return d.unreadAdmin; }).length;
      $("#reqChips").innerHTML = [["all", "الكل"], ["unread", "💬 رسائل جديدة"]].concat(ST.map(function (s) { return [s, s]; })).map(function (x) {
        return '<button type="button" data-f="' + esc(x[0]) + '" class="' + (filter === x[0] ? "active" : "") + '">' + esc(x[1]) + ' (' + c[x[0]] + ')</button>';
      }).join("");
      var l = docs.filter(function (d) {
        var ok = filter === "all" || (filter === "unread" ? d.unreadAdmin : (d.status || "جديد") === filter);
        return ok && (!q || [d.device, d.service, d.email, d.note].join(" ").toLowerCase().indexOf(q) > -1);
      });
      $("#reqList").innerHTML = l.length ? l.map(function (d) {
        return '<div class="item-row req-row' + (d.unreadAdmin ? " unread" : "") + '" data-id="' + esc(d._id) + '"><div class="item-main"><b>' + (d.unreadAdmin ? '<i class="unread-dot"></i>' : "") + esc(d.device || "جهاز") + ' — ' + esc(d.service || "خدمة") + ' ' + pill(d.status) + '</b><small>' + esc(d.email || "—") + ' · ' + A.fmt(d.createdAt) + '</small>' +
          (d.lastText ? '<small class="last-msg">' + (d.lastFrom === "customer" ? "العميل: " : "أنت: ") + esc(d.lastText) + '</small>' : (d.note ? '<small class="last-msg">' + esc(d.note) + '</small>' : "")) + '</div>' +
          '<div class="item-actions"><button class="btn btn-primary btn-sm" data-open>💬 محادثة</button><button class="icon-btn danger" data-del title="حذف">🗑</button></div></div>';
      }).join("") : '<div class="empty-state">مفيش طلبات مطابقة.</div>';
    }
    unsub = A.col("requests").onSnapshot(function (s) {
      if (!document.body.contains(root)) { unsub(); return; }
      docs = s.docs.map(function (x) { var d = x.data(); d._id = x.id; return d; }).sort(function (a, b) { return sec(b) - sec(a); });
      draw(); A.setBadge("requests", docs.filter(function (d) { return isNew(d) || d.unreadAdmin; }).length);
    }, function (e) { $("#reqList").innerHTML = '<div class="empty-state">' + esc(A.errMsg(e)) + '</div>'; });

    function openReq(id) {
      var d = docs.filter(function (x) { return x._id === id; })[0]; if (!d) return;
      var ref = A.col("requests").doc(id), usub;
      var box = A.modal.open('<h3>' + esc(d.device || "جهاز") + ' — ' + esc(d.service || "") + '</h3><p>' + esc(d.email || "") + ' · ' + A.fmt(d.createdAt) + '</p>' +
        (d.note ? '<div class="req-note">' + esc(d.note) + '</div>' : "") +
        '<div class="req-bar"><select id="rqSt">' + ST.map(function (s) { return '<option' + ((d.status || "جديد") === s ? " selected" : "") + '>' + s + '</option>'; }).join("") + '</select>' +
        (d.email ? '<a class="btn btn-ghost btn-sm" href="mailto:' + encodeURIComponent(d.email) + '?subject=' + encodeURIComponent("بخصوص طلبك: " + (d.device || "")) + '">✉ إيميل</a>' : "") + '</div>' +
        '<div class="chat" id="rqChat"><div class="chat-empty">جاري التحميل…</div></div>' +
        '<div class="tpl">' + TPL.map(function (t, i) { return '<button type="button" data-t="' + i + '">' + esc(t.slice(0, 22)) + '…</button>'; }).join("") + '</div>' +
        '<textarea id="rqText" rows="2" maxlength="1000" placeholder="اكتب ردك… (Ctrl+Enter للإرسال)"></textarea>' +
        '<div class="modal-actions"><button class="btn btn-primary" id="rqSend" type="button">إرسال الرد</button><button class="btn btn-ghost" id="rqClose" type="button">إغلاق</button></div>', true);
      if (d.unreadAdmin) ref.update({ unreadAdmin: false }).catch(function () {});
      usub = ref.collection("messages").orderBy("createdAt", "asc").onSnapshot(function (s) {
        var chat = $("#rqChat"); if (!chat) { usub(); return; }
        chat.innerHTML = s.empty ? '<div class="chat-empty">لسه مفيش رسائل. ابدأ بالرد 👇</div>' : s.docs.map(function (x) {
          var m = x.data(), mine = m.from === "admin";
          return '<div class="msg ' + (mine ? "mine" : "theirs") + '"><p>' + esc(m.text) + '</p><small>' + (mine ? "أنت" : "العميل") + ' · ' + (m.createdAt ? A.fmt(m.createdAt) : "…") + '</small></div>';
        }).join("");
        chat.scrollTop = chat.scrollHeight;
        if (!s.empty && s.docs[s.size - 1].data().from === "customer") ref.update({ unreadAdmin: false }).catch(function () {});
      });
      function send() {
        var t = $("#rqText").value.trim(), b = $("#rqSend"); if (!t) return; b.disabled = true;
        ref.collection("messages").add({ from: "admin", uid: A.user.uid, name: A.user.email || "الدعم", text: t, createdAt: ts() }).then(function () {
          var up = { lastFrom: "admin", lastMessageAt: ts(), lastText: t.slice(0, 140), unreadAdmin: false, unreadCustomer: true };
          if (!d.status || d.status === "جديد") up.status = "قيد التنفيذ";
          return ref.update(up);
        }).then(function () { $("#rqText").value = ""; A.log("reply", d.email, d.device); }).catch(function (e) { A.toast(A.errMsg(e), true); }).then(function () { b.disabled = false; });
      }
      box.onclick = function (e) {
        var t = e.target;
        if (t.id === "rqSend") send();
        if (t.id === "rqClose") { usub(); A.modal.close(); }
        if (t.getAttribute && t.getAttribute("data-t") != null) { $("#rqText").value = TPL[+t.getAttribute("data-t")]; $("#rqText").focus(); }
      };
      box.onchange = function (e) { if (e.target.id === "rqSt") ref.update({ status: e.target.value }).then(function () { A.toast("تم تحديث الحالة"); A.log("status", d.email, d.device + " ← " + e.target.value); }).catch(function (er) { A.toast(A.errMsg(er), true); }); };
      box.onkeydown = function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); };
    }
    $("#reqChips").addEventListener("click", function (e) { var b = e.target.closest("[data-f]"); if (b) { filter = b.getAttribute("data-f"); draw(); } });
    $("#reqSearch").addEventListener("input", function () { q = this.value.trim().toLowerCase(); draw(); });
    $("#reqList").addEventListener("click", function (e) {
      var row = e.target.closest(".item-row"); if (!row) return; var id = row.getAttribute("data-id");
      if (e.target.closest("[data-open]")) openReq(id);
      if (e.target.closest("[data-del]")) A.confirm("حذف الطلب؟", "هيتحذف نهائياً من حساب العميل كمان.", { ok: "حذف" }).then(function (ok) {
        if (ok) A.col("requests").doc(id).delete().then(function () { A.log("delete_req", "", id); A.toast("تم الحذف"); }).catch(function (er) { A.toast(A.errMsg(er), true); });
      });
    });
    $("#csvBtn").onclick = function () {
      var rows = [["التاريخ", "الإيميل", "الخدمة", "الجهاز", "الملاحظات", "الحالة"]].concat(docs.map(function (d) { return [A.fmt(d.createdAt), d.email, d.service, d.device, d.note, d.status || "جديد"]; }));
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + rows.map(function (r) { return r.map(csv).join(","); }).join("\r\n")], { type: "text/csv;charset=utf-8" }));
      a.download = "twins-requests-" + new Date().toISOString().slice(0, 10) + ".csv"; document.body.appendChild(a); a.click(); a.remove();
    };
  };

  A.views.activity = function (root) {
    root.innerHTML = '<div class="panel-head"><div><h2>سجل النشاط</h2><p>كل إجراء إداري: مين عمله وعلى مين ومتى. للقراءة فقط.</p></div></div><div class="toolbar"><select id="acF"><option value="">كل الأنواع</option>' +
      Object.keys(LABEL).map(function (k) { return '<option value="' + k + '">' + LABEL[k] + '</option>'; }).join("") + '</select><label class="search-box"><span>⌕</span><input type="search" id="acQ" placeholder="بحث بالشخص أو الهدف…"></label></div><div class="item-list" id="acList"><div class="empty-state">جاري التحميل…</div></div>';
    var rows = [];
    function draw() {
      var f = $("#acF").value, q = $("#acQ").value.trim().toLowerCase();
      var l = rows.filter(function (r) { return (!f || r.type === f) && (!q || [r.by, r.target, r.info].join(" ").toLowerCase().indexOf(q) > -1); });
      $("#acList").innerHTML = l.length ? l.map(function (r) {
        return '<div class="item-row"><div class="item-main"><b>' + (LABEL[r.type] || esc(r.type)) + ' <span class="pill new">' + esc(r.target || "—") + '</span></b><small>' + esc(r.by) + (r.info ? " · " + esc(r.info) : "") + ' · ' + A.fmt(r.createdAt) + '</small></div></div>';
      }).join("") : '<div class="empty-state">لا يوجد نشاط.</div>';
    }
    A.col("activity").orderBy("createdAt", "desc").limit(300).get().then(function (s) { rows = s.docs.map(function (d) { return d.data(); }); draw(); })
      .catch(function (e) { $("#acList").innerHTML = '<div class="empty-state">' + esc(A.errMsg(e)) + '</div>'; });
    $("#acF").addEventListener("change", draw); $("#acQ").addEventListener("input", draw);
  };
})(window.ADM);
