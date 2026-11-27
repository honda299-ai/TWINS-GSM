/* TWINS GSM — منطقة PRO للأعضاء (الحماية الحقيقية في firestore.rules) */
(function () {
  "use strict";
  if (!window.firebase || !firebase.apps.length) return;
  var auth = firebase.auth(), db = firebase.firestore();
  var $ = function (s) { return document.querySelector(s); };
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toDate(t) { return t && t.toDate ? t.toDate() : (t ? new Date(t) : null); }
  function secret(label, val) {
    return val ? '<div>' + esc(label) + ': <code data-v="' + esc(val) + '" class="mask">••••••••</code> <button type="button" class="text-btn" data-show>إظهار</button> <button type="button" class="text-btn" data-copy>نسخ</button></div>' : "";
  }
  function itemsHtml(items) {
    return items.filter(function (x) { return x.active !== false; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).map(function (i) {
      return '<div class="pro-item"><b>' + esc(i.title) + '</b>' + (i.notes ? '<small>' + esc(i.notes) + '</small>' : "") +
        (i.url && /^https?:\/\//i.test(i.url) ? '<div><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href="' + esc(i.url) + '">فتح / تحميل ↗</a></div>' : "") +
        secret("اليوزر", i.username) + secret("الباسورد", i.password) + '</div>';
    }).join("");
  }
  function render(user) {
    var card = $("#proCard"), body = $("#proBody"), badge = $("#proBadge");
    if (!card) return;
    if (!user) { card.hidden = true; return; }
    card.hidden = false; body.innerHTML = "جاري التحميل…";
    var isAdm = false;
    db.collection("admins").doc((user.email || "").toLowerCase()).get().then(function () { isAdm = true; }, function () {}).then(function () { return db.collection("memberships").doc(user.uid).get(); }).then(function (m) {
      var d = m.exists ? m.data() : null, exp = d && toDate(d.expiresAt), now = new Date();
      var ok = isAdm || d && d.active === true && d.level === "pro" && exp && exp > now && user.emailVerified !== false;
      badge.textContent = isAdm ? "ADMIN" : (ok ? "PRO" : "غير مفعّل"); badge.classList.toggle("off", !ok);
      if (!ok) {
        var msg = !d ? "ماعندكش عضوية PRO." : (exp && exp <= now ? "انتهت عضويتك بتاريخ " + exp.toLocaleDateString("ar-EG") + "." : "عضويتك موقوفة.");
        body.innerHTML = '<p>' + msg + ' اطلب الترقية وهنتواصل معاك.</p><button class="btn btn-primary btn-sm" id="reqPro" type="button">اطلب ترقية PRO</button>';
        $("#reqPro").onclick = function () {
          this.disabled = true;
          db.collection("requests").add({ uid: user.uid, email: user.email || "", service: "ترقية PRO", device: "—", note: "طلب عضوية PRO", status: "جديد", createdAt: firebase.firestore.FieldValue.serverTimestamp() })
            .then(function () { body.insertAdjacentHTML("beforeend", "<p>✅ وصل طلبك.</p>"); });
        };
        body.insertAdjacentHTML("beforeend", '<div class="pro-vault" id="freeVault"></div>');
        db.collection("proVault").where("forAll", "==", true).get().then(function (s) {
          var h = itemsHtml(s.docs.map(function (x) { return x.data(); })); $("#freeVault").innerHTML = h ? "<b>متاح لكل الأعضاء:</b>" + h : "";
        }).catch(function () {});
        return;
      }
      var days = exp ? Math.ceil((exp - now) / 864e5) : 0;
      body.innerHTML = (isAdm ? '<p>صلاحية أدمن: وصول كامل لكل محتوى PRO بدون انتهاء.</p>' : '<p>ينتهي في <b>' + exp.toLocaleDateString("ar-EG") + '</b> — باقي <b>' + days + '</b> يوم.</p>') + '<div class="pro-vault" id="vault">جاري التحميل…</div>';
      db.collection("proVault").get().then(function (s) {
        var items = s.docs.map(function (x) { return x.data(); }).filter(function (x) { return x.active !== false; })
          .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
        $("#vault").innerHTML = items.length ? items.map(function (i) {
          return '<div class="pro-item"><b>' + esc(i.title) + '</b>' + (i.notes ? '<small>' + esc(i.notes) + '</small>' : "") +
            (i.url && /^https?:\/\//i.test(i.url) ? '<div><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href="' + esc(i.url) + '">فتح / تحميل ↗</a></div>' : "") +
            secret("اليوزر", i.username) + secret("الباسورد", i.password) + '</div>';
        }).join("") : "لسه مفيش محتوى PRO.";
      }).catch(function () { $("#vault").textContent = "مش مسموح لك بعرض المحتوى."; });
    }).catch(function () { body.textContent = "تعذّر تحميل العضوية."; });
  }
  document.addEventListener("click", function (e) {
    var t = e.target, row = t.closest && t.closest(".pro-item"); if (!row) return;
    var c = t.parentNode.querySelector("code"); if (!c) return;
    if (t.hasAttribute("data-show")) { var h = c.textContent.indexOf("•") === 0; c.textContent = h ? c.dataset.v : "••••••••"; t.textContent = h ? "إخفاء" : "إظهار"; }
    if (t.hasAttribute("data-copy") && navigator.clipboard) navigator.clipboard.writeText(c.dataset.v).then(function () { t.textContent = "تم ✓"; });
  });
  auth.onAuthStateChanged(function (u) {
    if (!u) return render(null);
    db.collection("users").doc(u.uid).get().then(function (d) {
      if (d.exists && d.data().blocked === true) {
        // الأدمن (والأدمن الأساسي) ماينفعش يتحظروا من الواجهة أبداً
        return db.collection("admins").doc((u.email || "").toLowerCase()).get().then(function () { render(u); }, function () {
          auth.signOut().then(function () { alert("تم إيقاف هذا الحساب. تواصل مع الدعم."); });
        });
      }
      if (d.exists) db.collection("users").doc(u.uid).set({ lastLoginAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(function () {});
      render(u);
    }).catch(function () { render(u); });
  });
})();
