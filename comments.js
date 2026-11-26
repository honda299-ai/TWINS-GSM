/* TWINS GSM — آراء الأعضاء المعتمدة */
(function () {
  "use strict";
  var tries = 0;
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function go() {
    var host = document.getElementById("reviewsGrid");
    if (!host || !window.firebase || !firebase.apps.length) { if (tries++ < 8) setTimeout(go, 900); return; }
    firebase.firestore().collection("comments").where("status", "==", "approved").limit(30).get().then(function (s) {
      var l = s.docs.map(function (d) { return d.data(); }).sort(function (a, b) { return (b.createdAt && b.createdAt.seconds || 0) - (a.createdAt && a.createdAt.seconds || 0); });
      if (!l.length) return;
      var box = document.getElementById("commentsGrid");
      if (!box) { box = document.createElement("div"); box.id = "commentsGrid"; box.className = "reviews-grid"; box.style.marginTop = "18px"; host.parentNode.insertBefore(box, host.nextSibling); }
      box.innerHTML = l.map(function (r) {
        var n = Math.max(1, Math.min(5, r.rating | 0));
        return '<article class="review"><div class="stars">' + "★★★★★".slice(0, n) + '<i>' + "★★★★★".slice(0, 5 - n) + '</i></div><p>' + esc(r.text) + '</p><div class="review-author"><span>' + esc(String(r.name || "?").charAt(0)) + '</span><div><b>' + esc(r.name) + '</b><small>عضو</small></div></div></article>';
      }).join("");
    }).catch(function () {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(go, 700); }); else setTimeout(go, 700);
})();
