/* TWINS GSM — تبويب التحميل: عادي / PRO (الحماية الحقيقية في firestore.rules) */
(function () {
  "use strict";
  var sec = document.getElementById("tools"), pane = document.getElementById("proPane"), tabs = document.getElementById("dlTabs");
  if (!sec || !pane || !tabs) return;
  var user = null, token = 0;
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toDate(t) { return t && t.toDate ? t.toDate() : (t ? new Date(t) : null); }
  function wa() { var a = document.querySelector('a[href*="wa.me"]'); return a ? a.href : "#contact"; }
  function lock(icon, title, text, btn) { pane.innerHTML = '<div class="pro-lock"><span>' + icon + '</span><h3>' + title + '</h3><p>' + text + '</p>' + btn + '</div>'; }
  function secret(l, v) { return v ? '<div>' + l + ': <code data-v="' + esc(v) + '">••••••••</code> <button type="button" class="text-btn" data-show>إظهار</button> <button type="button" class="text-btn" data-copy>نسخ</button></div>' : ""; }

  function render() {
    var me = ++token;
    if (!window.firebase || !firebase.apps.length) { lock("🔒", "تحميل PRO للأعضاء", "سجّل الدخول عشان تشوف الأدوات الحصرية.", '<a class="btn btn-primary" href="account.html">دخول / تسجيل ←</a>'); return; }
    if (!user) { lock("🔒", "سجّل الدخول أولاً", "تحميل PRO متاح لأعضاء PRO فقط. ادخل بحسابك الأول.", '<a class="btn btn-primary" href="account.html">دخول / تسجيل ←</a>'); return; }
    pane.innerHTML = '<p class="pro-wait">جاري التحقق من عضويتك…</p>';
    var db = firebase.firestore(), isAdm = false;
    db.collection("admins").doc((user.email || "").toLowerCase()).get().then(function () { isAdm = true; }, function () {})
      .then(function () { return db.collection("memberships").doc(user.uid).get(); })
      .then(function (m) {
        if (me !== token) return;
        var d = m.exists ? m.data() : null, exp = d && toDate(d.expiresAt), ok = isAdm || (d && d.active === true && d.level === "pro" && exp && exp > new Date());
        if (!ok) {
          var why = !d ? "ماعندكش عضوية PRO." : (exp && exp <= new Date() ? "عضويتك انتهت." : "عضويتك موقوفة.");
          lock("👑", "لازم تكون عضو PRO", why + " فعّل PRO عشان تفتح الأدوات والحسابات الحصرية.",
            '<button class="btn btn-primary" id="proReq" type="button">فعّل PRO الآن</button> <a class="btn btn-ghost" href="' + esc(wa()) + '" target="_blank" rel="noopener">كلّمنا واتساب</a>');
          document.getElementById("proReq").onclick = function () {
            var b = this; b.disabled = true;
            db.collection("requests").add({ uid: user.uid, email: user.email || "", service: "ترقية PRO", device: "—", note: "طلب تفعيل PRO من الموقع", status: "جديد", createdAt: firebase.firestore.FieldValue.serverTimestamp() })
              .then(function () { b.textContent = "✅ وصل طلبك، هنتواصل معاك"; }).catch(function () { b.disabled = false; b.textContent = "تعذّر الإرسال، حاول تاني"; });
          };
          return;
        }
        return db.collection("proVault").get().then(function (s) {
          if (me !== token) return;
          var items = s.docs.map(function (x) { return x.data(); }).filter(function (x) { return x.active !== false; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
          var left = exp ? Math.ceil((exp - new Date()) / 864e5) : 0;
          pane.innerHTML = '<div class="pro-ok">' + (isAdm ? "👑 صلاحية أدمن — وصول كامل" : "👑 عضويتك PRO نشطة — باقي " + left + " يوم") + '</div><div class="pro-grid">' +
            (items.length ? items.map(function (i) {
              return '<div class="pro-item"><b>' + esc(i.title) + '</b>' + (i.notes ? '<small>' + esc(i.notes) + '</small>' : "") +
                (i.url && /^https?:\/\//i.test(i.url) ? '<a class="btn btn-primary btn-sm" target="_blank" rel="noopener noreferrer" href="' + esc(i.url) + '">فتح / تحميل ↗</a>' : "") + secret("اليوزر", i.username) + secret("الباسورد", i.password) + '</div>';
            }).join("") : '<div class="empty-state">لسه مفيش محتوى PRO. هيتضاف قريب.</div>') + '</div>';
        });
      }).catch(function () { if (me === token) lock("⚠️", "تعذّر التحميل", "حاول تاني بعد شوية.", ""); });
  }

  tabs.addEventListener("click", function (e) {
    var b = e.target.closest("[data-tab]"); if (!b) return;
    var pro = b.getAttribute("data-tab") === "pro";
    tabs.querySelectorAll("button").forEach(function (x) { var a = x === b; x.classList.toggle("active", a); x.setAttribute("aria-selected", a); });
    sec.classList.toggle("show-pro", pro); pane.hidden = !pro;
    if (pro) render();
  });
  pane.addEventListener("click", function (e) {
    var t = e.target, c = t.parentNode && t.parentNode.querySelector("code"); if (!c) return;
    if (t.hasAttribute("data-show")) { var h = c.textContent.charAt(0) === "•"; c.textContent = h ? c.dataset.v : "••••••••"; t.textContent = h ? "إخفاء" : "إظهار"; }
    if (t.hasAttribute("data-copy") && navigator.clipboard) navigator.clipboard.writeText(c.dataset.v).then(function () { t.textContent = "تم ✓"; });
  });
  function watch() { if (window.firebase && firebase.apps.length) firebase.auth().onAuthStateChanged(function (u) { user = u; if (sec.classList.contains("show-pro")) render(); }); else setTimeout(watch, 700); }
  watch();
})();
