/* TWINS GSM — منطقة PRO للأعضاء (الحماية الحقيقية في firestore.rules) */
(function () {
  "use strict";
  if (!window.firebase || !firebase.apps.length) return;

  var auth = firebase.auth(), db = firebase.firestore();
  var $ = function (s) { return document.querySelector(s); };
  var SUPER = "hondastore299@gmail.com";

  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toDate(t) { return t && t.toDate ? t.toDate() : (t ? new Date(t) : null); }
  function safeUrl(v) { return /^https?:\/\//i.test(String(v || "").trim()) ? String(v).trim() : ""; }
  function safeImg(v) {
    var s = String(v || "").trim();
    if (!s) return "";
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+\/=]+$/i.test(s)) return s;
    if (/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(s)) return s;
    return /^[a-zA-Z0-9_\-./]+$/.test(s) ? s : "";
  }
  function shown(i, key, has) { return has && i[key] !== false; }

  function copyText(text, btn) {
    function done() {
      var old = btn.getAttribute("data-label") || btn.textContent;
      btn.setAttribute("data-label", old);
      btn.textContent = "تم النسخ ✓";
      btn.classList.add("copied");
      setTimeout(function () { btn.textContent = old; btn.classList.remove("copied"); }, 1600);
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { btn.textContent = "انسخ يدوياً"; }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  function secret(label, val) {
    if (!val) return "";
    var v = esc(val);
    return '<div class="pro-secret" data-secret><span>' + esc(label) + '</span>' +
      '<code data-v="' + v + '">••••••••</code>' +
      '<button type="button" class="text-btn" data-show>إظهار</button>' +
      '<button type="button" class="text-btn copy" data-copy data-copy-text="' + v + '">نسخ</button></div>';
  }

  function itemsHtml(items, freeAccess) {
    var list = (items || []).filter(function (x) { return x && x.active !== false; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    if (!list.length) return '<div class="pro-empty">لسه مفيش محتوى PRO.</div>';
    return '<div class="pro-grid">' + list.map(function (i) {
      var img = shown(i, "showImage", safeImg(i.image));
      var url = shown(i, "showUrl", safeUrl(i.url));
      var copy = shown(i, "showCopy", String(i.copyText || "").trim());
      return '<article class="pro-item">' +
        (img ? '<img class="card-img" src="' + esc(img) + '" alt="" loading="lazy" />' : "") +
        '<div class="pro-item-body">' +
          '<span class="pro-item-badge">' + (freeAccess ? "✆ متاح للأعضاء" : "👑 PRO") + '</span>' +
          '<h4>' + esc(i.title || "عنصر PRO") + '</h4>' +
          (i.notes ? '<p>' + esc(i.notes) + '</p>' : "") +
          ((url || copy) ? '<div class="pro-item-actions">' +
            (url ? '<a class="btn btn-primary btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(i.urlLabel || "فتح / تحميل ↗") + '</a>' : "") +
            (copy ? '<button type="button" class="btn btn-ghost btn-sm" data-copy data-copy-text="' + esc(copy) + '">' + esc(i.copyLabel || "نسخ النص") + '</button>' : "") +
          '</div>' : "") +
          secret("اليوزر", i.username) + secret("الباسورد", i.password) +
        '</div></article>';
    }).join("") + '</div>';
  }

  function docsOf(snap) { return snap.docs.map(function (d) { return d.data(); }); }

  function render(user) {
    var card = $("#proCard"), body = $("#proBody"), badge = $("#proBadge");
    if (!card) return;
    if (!user) { card.hidden = true; return; }
    card.hidden = false;
    body.innerHTML = '<div class="pro-loading"><span></span><p>جاري التحميل…</p></div>';

    var isSuper = String(user.email || "").toLowerCase() === SUPER;
    var now = new Date();

    db.collection("memberships").doc(user.uid).get().then(function (m) {
      var d = m.exists ? m.data() : null, exp = d && toDate(d.expiresAt);
      var pro = !!(d && d.active === true && d.level === "pro" && exp && exp > now && user.emailVerified !== false);
      badge.textContent = isSuper ? "ADMIN" : (pro ? "PRO" : "غير مفعّل");
      badge.classList.toggle("off", !pro && !isSuper);

      if (!pro && !isSuper) {
        var msg = !d ? "ماعندكش عضوية PRO." : (exp && exp <= now ? "انتهت عضويتك بتاريخ " + exp.toLocaleDateString("ar-EG") + "." : "عضويتك موقوفة.");
        body.innerHTML = '<div class="pro-upgrade"><span aria-hidden="true">👑</span><div><h3>فعّل PRO وافتح كل الأدوات</h3><p>' + esc(msg) + '</p></div>' +
          '<div class="pro-upgrade-actions"><button class="btn btn-primary btn-sm" type="button" id="reqPro">اطلب ترقية PRO</button></div></div>' +
          '<div class="pro-vault" id="freeVault"></div>';
        $("#reqPro").onclick = function () {
          var b = this; b.disabled = true;
          db.collection("requests").add({
            uid: user.uid, email: user.email || "", service: "ترقية PRO", device: "—",
            note: "طلب عضوية PRO", status: "جديد", createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }).then(function () { b.textContent = "✅ وصل طلبك"; })
            .catch(function () { b.disabled = false; b.textContent = "حاول تاني"; });
        };
        return db.collection("proVault").where("forAll", "==", true).get().then(function (s) {
          var h = itemsHtml(docsOf(s), true);
          $("#freeVault").innerHTML = h.indexOf("pro-empty") === -1 ? '<h3 class="pro-subtitle">✆ متاح لكل الأعضاء</h3>' + h : "";
        }).catch(function () { $("#freeVault").innerHTML = ""; });
      }

      var days = exp ? Math.ceil((exp - now) / 864e5) : 0;
      body.innerHTML = '<p class="pro-status">' + (isSuper
        ? "صلاحية أدمن: وصول كامل لكل محتوى PRO بدون انتهاء."
        : "ينتهي في <b>" + exp.toLocaleDateString("ar-EG") + "</b> — باقي <b>" + days + "</b> يوم.") + '</p>' +
        '<div class="pro-vault" id="vault"><div class="pro-loading"><span></span><p>جاري التحميل…</p></div></div>';

      db.collection("proVault").get().then(function (s) {
        $("#vault").innerHTML = itemsHtml(docsOf(s), false);
      }).catch(function () {
        return db.collection("proVault").where("forAll", "==", true).get().then(function (s) {
          $("#vault").innerHTML = '<p class="pro-status">تعذّر فتح كل المحتوى — ده المتاح لك دلوقتي:</p>' + itemsHtml(docsOf(s), true);
        }).catch(function () { $("#vault").innerHTML = '<div class="pro-empty">مش مسموح لك بعرض المحتوى.</div>'; });
      });
    }).catch(function () { body.innerHTML = '<div class="pro-empty">تعذّر تحميل العضوية.</div>'; });
  }

  document.addEventListener("click", function (e) {
    var show = e.target.closest && e.target.closest("[data-show]");
    if (show) {
      var row = show.closest("[data-secret]");
      var c = row && row.querySelector("code");
      if (!c) return;
      var hidden = c.textContent.charAt(0) === "•";
      c.textContent = hidden ? c.dataset.v : "••••••••";
      show.textContent = hidden ? "إخفاء" : "إظهار";
      return;
    }
    var copy = e.target.closest && e.target.closest("[data-copy]");
    if (copy) {
      var text = copy.getAttribute("data-copy-text") || "";
      if (text) copyText(text, copy);
    }
  });

  auth.onAuthStateChanged(function (u) {
    if (!u) return render(null);
    db.collection("users").doc(u.uid).get().then(function (d) {
      if (d.exists && d.data().blocked === true && String(u.email || "").toLowerCase() !== SUPER) {
        // الأدمن (والأدمن الأساسي) ماينفعش يتحظروا من الواجهة أبداً
        return db.collection("admins").doc(String(u.email || "").toLowerCase()).get().then(function () { render(u); }, function () {
          auth.signOut().then(function () { alert("تم إيقاف هذا الحساب. تواصل مع الدعم."); });
        });
      }
      render(u);
    }).catch(function () { render(u); });
  });
})();
