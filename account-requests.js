/* TWINS GSM — طلباتي ومحادثاتي (العميل يتابع الحالة ويرد جوه الموقع) */
(function () {
  "use strict";
  if (!window.firebase || !firebase.apps.length) return;
  var auth = firebase.auth(), db = firebase.firestore(), $ = function (s) { return document.querySelector(s); };
  var ST = ["جديد", "قيد التنفيذ", "تم التنفيذ"], unsubs = {}, listUnsub = null, open = {};
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ts() { return firebase.firestore.FieldValue.serverTimestamp(); }
  function fmt(t) { try { return (t.toDate ? t.toDate() : new Date(t)).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return "…"; } }

  function steps(s) {
    var i = Math.max(0, ST.indexOf(s || "جديد"));
    return '<ol class="steps-track">' + ST.map(function (x, k) { return '<li class="' + (k < i ? "done" : k === i ? "now" : "") + '"><i>' + (k < i ? "✓" : k + 1) + '</i><span>' + x + '</span></li>'; }).join("") + '</ol>';
  }
  function thread(id, user, host) {
    var ref = db.collection("requests").doc(id);
    host.innerHTML = '<div class="chat" data-chat><div class="chat-empty">جاري التحميل…</div></div><div class="chat-send"><textarea rows="2" maxlength="1000" placeholder="اكتب رسالتك للدعم…"></textarea><button type="button" class="btn btn-primary btn-sm" data-send>إرسال</button></div>';
    ref.update({ unreadCustomer: false }).catch(function () {});
    unsubs[id] = ref.collection("messages").orderBy("createdAt", "asc").onSnapshot(function (s) {
      var chat = host.querySelector("[data-chat]"); if (!chat) return;
      chat.innerHTML = s.empty ? '<div class="chat-empty">ابعت رسالتك وهنرد عليك هنا.</div>' : s.docs.map(function (x) {
        var m = x.data(), mine = m.from === "customer";
        return '<div class="msg ' + (mine ? "mine" : "theirs") + '"><p>' + esc(m.text) + '</p><small>' + (mine ? "أنت" : "الدعم") + ' · ' + (m.createdAt ? fmt(m.createdAt) : "…") + '</small></div>';
      }).join("");
      chat.scrollTop = chat.scrollHeight;
      if (!s.empty && s.docs[s.size - 1].data().from === "admin") ref.update({ unreadCustomer: false }).catch(function () {});
    });
    host.querySelector("[data-send]").onclick = function () {
      var ta = host.querySelector("textarea"), t = ta.value.trim(), b = this; if (!t) return; b.disabled = true;
      ref.collection("messages").add({ from: "customer", uid: user.uid, name: user.displayName || user.email || "عميل", text: t, createdAt: ts() })
        .then(function () { return ref.update({ lastFrom: "customer", lastMessageAt: ts(), lastText: t.slice(0, 140), unreadAdmin: true }); })
        .then(function () { ta.value = ""; }).catch(function () { alert("تعذّر الإرسال."); }).then(function () { b.disabled = false; });
    };
  }
  function render(docs, user) {
    var box = $("#reqList2");
    box.innerHTML = docs.length ? docs.map(function (d) {
      return '<div class="req-card" data-id="' + d._id + '"><div class="req-card-head"><div><b>' + esc(d.device || "جهاز") + '</b><small>' + esc(d.service || "") + ' · ' + (d.createdAt ? fmt(d.createdAt) : "…") + '</small></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-toggle>' + (d.unreadCustomer ? '<i class="unread-dot"></i>' : "") + '💬 المحادثة</button></div>' + steps(d.status) +
        (d.lastText ? '<small class="last-msg">' + (d.lastFrom === "admin" ? "الدعم: " : "أنت: ") + esc(d.lastText) + '</small>' : "") + '<div class="req-thread" hidden></div></div>';
    }).join("") : '<div class="empty-state">لسه ماعندكش طلبات. ابعت أول طلب من النموذج.</div>';
    Object.keys(open).forEach(function (id) {
      var c = box.querySelector('[data-id="' + id + '"] .req-thread'); if (c) { c.hidden = false; thread(id, user, c); }
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-toggle]"); if (!b || !auth.currentUser) return;
    var card = b.closest(".req-card"), id = card.getAttribute("data-id"), host = card.querySelector(".req-thread");
    if (host.hidden) { open[id] = 1; host.hidden = false; thread(id, auth.currentUser, host); }
    else { delete open[id]; host.hidden = true; if (unsubs[id]) { unsubs[id](); delete unsubs[id]; } }
  });
  auth.onAuthStateChanged(function (u) {
    var c = $("#reqCard"); if (!c) return; if (listUnsub) { listUnsub(); listUnsub = null; }
    c.hidden = !u; if (!u) return;
    listUnsub = db.collection("requests").where("uid", "==", u.uid).onSnapshot(function (s) {
      var docs = s.docs.map(function (x) { var d = x.data(); d._id = x.id; return d; }).sort(function (a, b) { return (b.createdAt && b.createdAt.seconds || 0) - (a.createdAt && a.createdAt.seconds || 0); });
      Object.keys(unsubs).forEach(function (k) { unsubs[k](); delete unsubs[k]; });
      render(docs, u);
    }, function () { $("#reqList2").innerHTML = '<div class="empty-state">تعذّر تحميل طلباتك.</div>'; });
  });
})();
