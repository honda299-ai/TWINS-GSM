/* TWINS GSM — إضافة تعليق من حساب العضو (يظهر بعد موافقة الأدمن) */
(function () {
  "use strict";
  if (!window.firebase || !firebase.apps.length) return;
  var auth = firebase.auth(), db = firebase.firestore(), $ = function (s) { return document.querySelector(s); };
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var LBL = { pending: ["بانتظار الموافقة", "new"], approved: ["منشور", "ok"], hidden: ["مخفي", "warn"] };
  function mine(u) {
    db.collection("comments").where("uid", "==", u.uid).get().then(function (s) {
      $("#cmtMine").innerHTML = s.docs.map(function (d) { return [d.id, d.data()]; }).map(function (x) {
        var c = x[1], l = LBL[c.status] || LBL.pending;
        return '<div class="pro-item"><span class="pill ' + l[1] + '">' + l[0] + '</span> ' + "★".repeat(c.rating | 0) + '<p>' + esc(c.text) + '</p><button type="button" class="text-btn" data-del="' + x[0] + '">حذف</button></div>';
      }).join("");
    }).catch(function () {});
  }
  function form(u) {
    $("#cmtForm").innerHTML = '<select id="cmtRate" aria-label="التقييم"><option value="5">★★★★★ ممتاز</option><option value="4">★★★★ جيد جداً</option><option value="3">★★★ جيد</option><option value="2">★★ مقبول</option><option value="1">★ ضعيف</option></select>' +
      '<textarea id="cmtText" rows="3" maxlength="400" placeholder="اكتب رأيك في الخدمة (5 - 400 حرف)" style="width:100%;margin:8px 0"></textarea><button class="btn btn-primary btn-sm" id="cmtSend" type="button">إرسال التعليق</button> <span id="cmtMsg"></span>';
    $("#cmtSend").onclick = function () {
      var t = $("#cmtText").value.trim(), m = $("#cmtMsg");
      if (t.length < 5) { m.textContent = "اكتب 5 أحرف على الأقل."; return; }
      this.disabled = true;
      db.collection("comments").add({ uid: u.uid, name: (u.displayName || (u.email || "").split("@")[0] || "عضو").slice(0, 60), text: t, rating: parseInt($("#cmtRate").value, 10), status: "pending", createdAt: firebase.firestore.FieldValue.serverTimestamp() })
        .then(function () { $("#cmtText").value = ""; m.textContent = "✅ وصل تعليقك وهيظهر بعد الموافقة."; mine(u); })
        .catch(function () { m.textContent = "تعذّر الإرسال."; }).then(function () { $("#cmtSend").disabled = false; });
    };
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-del]"); if (!b || !auth.currentUser) return;
    db.collection("comments").doc(b.getAttribute("data-del")).delete().then(function () { mine(auth.currentUser); });
  });
  auth.onAuthStateChanged(function (u) { var c = $("#cmtCard"); if (!c) return; c.hidden = !u; if (u) { form(u); mine(u); } });
})();
