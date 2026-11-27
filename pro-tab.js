/* TWINS GSM — تبويب التحميل: عادي / PRO (الحماية الحقيقية في firestore.rules) */
(function () {
  "use strict";
  var sec = document.getElementById("tools"), pane = document.getElementById("proPane"), tabs = document.getElementById("dlTabs");
  if (!sec || !pane || !tabs) return;

  var user = null, token = 0;
  var SUPER = "hondastore299@gmail.com";

  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toDate(t) { return t && t.toDate ? t.toDate() : (t ? new Date(t) : null); }
  function wa() { var a = document.querySelector('a[href*="wa.me"]'); return a && /^https?:\/\//i.test(a.href) ? a.href : "#contact"; }
  function safeUrl(v) { return /^https?:\/\//i.test(String(v || "").trim()) ? String(v).trim() : ""; }
  function safeImg(v) {
    var s = String(v || "").trim();
    if (!s) return "";
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+\/=]+$/i.test(s)) return s;
    if (/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(s)) return s;
    return /^[a-zA-Z0-9_\-./]+$/.test(s) ? s : "";
  }
  function shown(i, key, has) { return has && i[key] !== false; }

  /* نسخ متوافق مع المتصفحات اللي مفيهاش Clipboard API (ملف محلي / http) */
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

  function itemHtml(i, freeAccess) {
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
  }

  function itemsHtml(items, freeAccess) {
    if (!items.length) return '<div class="pro-empty">لسه مفيش محتوى هنا. هيتضاف قريب.</div>';
    return '<div class="pro-grid">' + items.map(function (i) { return itemHtml(i, freeAccess); }).join("") + '</div>';
  }

  function lock(icon, title, text, btn) {
    pane.innerHTML = '<div class="pro-lock"><span class="pro-lock-icon" aria-hidden="true">' + icon + '</span>' +
      '<h3>' + title + '</h3><p>' + text + '</p>' + (btn || "") + '</div>';
  }

  function upgradePanel(reason) {
    return '<div class="pro-upgrade"><span aria-hidden="true">👑</span><div><h3>لازم تكون عضو PRO</h3>' +
      '<p>' + esc(reason || "فعّل PRO عشان تفتح الأدوات والحسابات الحصرية.") + '</p></div>' +
      '<div class="pro-upgrade-actions">' +
        '<button class="btn btn-primary" type="button" data-pro-request>فعّل PRO الآن</button>' +
        '<a class="btn btn-ghost" href="' + esc(wa()) + '" target="_blank" rel="noopener noreferrer">كلّمنا واتساب ↗</a>' +
      '</div></div>';
  }

  function showItems(items, note, freeAccess, upgrade) {
    pane.innerHTML = '<div class="pro-ok">' + note + '</div>' + (upgrade || "") + itemsHtml(items, freeAccess);
  }

  function render() {
    var me = ++token;
    if (!window.firebase || !firebase.apps.length) {
      lock("🔒", "تحميل PRO للأعضاء", "سجّل الدخول عشان تشوف الأدوات الحصرية.", '<a class="btn btn-primary" href="account.html">دخول / تسجيل ←</a>');
      return;
    }
    if (!user) {
      lock("🔒", "سجّل الدخول أولاً", "تحميل PRO متاح للأعضاء المسجلين. ادخل بحسابك الأول.", '<a class="btn btn-primary" href="account.html">دخول / تسجيل ←</a>');
      return;
    }

    pane.innerHTML = '<div class="pro-loading"><span></span><p>جاري التحقق من عضويتك…</p></div>';
    var db = firebase.firestore();
    var isSuper = String(user.email || "").toLowerCase() === SUPER;
    var now = new Date();

    // قراءة العضوية فقط (مسموحة لصاحب الحساب) — بدون قراءة مجموعة admins اللي بتطلع خطأ للعضو العادي.
    db.collection("memberships").doc(user.uid).get().then(function (m) {
      if (me !== token) return;
      var d = m.exists ? m.data() : null;
      var exp = d && toDate(d.expiresAt);
      var pro = !!(d && d.active === true && d.level === "pro" && exp && exp > now && user.emailVerified !== false);

      function itemsFrom(snap) {
        return snap.docs.map(function (x) { return x.data(); })
          .filter(function (x) { return x && x.active !== false; })
          .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      }
      function expiryNote() {
        if (isSuper) return "👑 صلاحية أدمن — وصول كامل لكل المحتوى";
        var left = exp ? Math.ceil((exp - now) / 864e5) : 0;
        return "👑 عضويتك PRO نشطة — باقي " + left + " يوم";
      }
      function reason() {
        if (!d) return "ماعندكش عضوية PRO.";
        if (exp && exp <= now) return "عضويتك انتهت.";
        return "عضويتك موقوفة أو مش مفعّلة.";
      }

      if (pro || isSuper) {
        // القواعد سمحت بالقراءة الكاملة للأدمن وعضو PRO — لو حصل خطأ نرجع للمحتوى المتاح للكل.
        return db.collection("proVault").get().then(function (s) {
          if (me === token) showItems(itemsFrom(s), expiryNote(), false, "");
        }).catch(function () {
          return db.collection("proVault").where("forAll", "==", true).get().then(function (s) {
            if (me === token) showItems(itemsFrom(s), "👑 محتوى متاح لكل الأعضاء", true, upgradePanel("تعذّر فتح كل المحتوى. جرب تاني بعد شوية."));
          });
        });
      }

      // عضو عادي: القواعد بتسمح بقراءة عناصر forAll فقط.
      return db.collection("proVault").where("forAll", "==", true).get().then(function (s) {
        if (me !== token) return;
        var items = itemsFrom(s);
        if (items.length) showItems(items, "✆ متاح لكل الأعضاء المسجلين", true, upgradePanel(reason()));
        else lock("👑", "محتوى PRO للأعضاء", reason() + " فعّل PRO عشان تفتح الأدوات والحسابات الحصرية.", upgradePanel(""));
      }).catch(function () {
        if (me === token) lock("⚠️", "تعذّر التحميل", "حاول تاني بعد شوية، أو كلّمنا على واتساب.", upgradePanel(""));
      });
    }).catch(function () { if (me === token) lock("⚠️", "تعذّر التحقق من العضوية", "حاول تسجيل الدخول تاني بعد شوية.", ""); });
  }

  tabs.addEventListener("click", function (e) {
    var b = e.target.closest("[data-tab]");
    if (!b) return;
    var pro = b.getAttribute("data-tab") === "pro";
    tabs.querySelectorAll("button").forEach(function (x) {
      var a = x === b;
      x.classList.toggle("active", a);
      x.setAttribute("aria-selected", String(a));
    });
    sec.classList.toggle("show-pro", pro);
    pane.hidden = !pro;
    var free = document.getElementById("freePane");
    if (free) free.hidden = pro;
    if (pro) render();
  });

  pane.addEventListener("click", function (e) {
    var show = e.target.closest("[data-show]");
    if (show) {
      var row = show.closest("[data-secret]");
      var code = row && row.querySelector("code");
      if (!code) return;
      var hidden = code.textContent.charAt(0) === "•";
      code.textContent = hidden ? code.dataset.v : "••••••••";
      show.textContent = hidden ? "إخفاء" : "إظهار";
      return;
    }
    var copy = e.target.closest("[data-copy]");
    if (copy) {
      var text = copy.getAttribute("data-copy-text") || "";
      if (text) copyText(text, copy);
      return;
    }
    var req = e.target.closest("[data-pro-request]");
    if (req && !req.disabled && window.firebase && firebase.apps.length && user) {
      var b = req;
      b.disabled = true;
      firebase.firestore().collection("requests").add({
        uid: user.uid, email: user.email || "", service: "ترقية PRO", device: "—",
        note: "طلب تفعيل PRO من الموقع", status: "جديد",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function () { b.textContent = "✅ وصل طلبك، هنتواصل معاك"; })
        .catch(function () { b.disabled = false; b.textContent = "تعذّر الإرسال، حاول تاني"; });
    }
  });

  function watch() {
    if (window.firebase && firebase.apps.length) firebase.auth().onAuthStateChanged(function (u) {
      user = u;
      if (sec.classList.contains("show-pro")) render();
    });
    else setTimeout(watch, 700);
  }
  watch();
})();
