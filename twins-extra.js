/* TWINS GSM — أدوات مشتركة: ضغط الصور، تفعيل الأكواد، عرض الصور */
(function () {
  "use strict";
  window.TWINS_COMPRESS = function (file) {
    return new Promise(function (ok, no) {
      if (!file || !/^image\//.test(file.type)) return no(new Error("ملف غير صالح"));
      var fr = new FileReader();
      fr.onerror = function () { no(new Error("read")); };
      fr.onload = function () {
        var im = new Image();
        im.onerror = function () { no(new Error("img")); };
        im.onload = function () {
          var w = Math.min(900, im.width), q = .82, out = "";
          for (var k = 0; k < 6; k++) {
            var c = document.createElement("canvas"); c.width = w; c.height = Math.round(im.height * w / im.width);
            c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
            out = c.toDataURL("image/jpeg", q);
            if (out.length < 150000) return ok(out);
            w = Math.round(w * .8); q = Math.max(.5, q - .08);
          }
          no(new Error("big"));
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  };

  window.TWINS_REDEEM = function (user, raw) {
    var db = firebase.firestore(), code = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
    if (code.length < 8) return Promise.reject(new Error("اكتب الكود صح."));
    var cref = db.collection("proCodes").doc(code), mref = db.collection("memberships").doc(user.uid);
    return Promise.all([cref.get(), mref.get()]).then(function (r) {
      if (!r[0].exists) throw new Error("الكود غير صحيح.");
      var d = r[0].data(), now = new Date();
      if (d.active !== true) throw new Error("الكود موقوف.");
      if (d.expiresAt && d.expiresAt.toDate() < now) throw new Error("الكود منتهي.");
      if ((d.used || 0) >= d.maxUses) throw new Error("الكود اتستخدم بالكامل.");
      var m = r[1].exists ? r[1].data() : null, base = now;
      if (m && m.expiresAt && m.expiresAt.toDate() > now) base = m.expiresAt.toDate();
      var exp = new Date(base.getTime() + d.days * 864e5), TS = firebase.firestore.FieldValue.serverTimestamp(), b = db.batch();
      b.update(cref, { used: (d.used || 0) + 1, lastUsedBy: user.uid });
      b.set(db.collection("redemptions").doc(code + "_" + user.uid), { code: code, uid: user.uid, email: user.email || "", at: TS });
      b.set(mref, { email: user.email || "", name: user.displayName || "", level: "pro", active: true, expiresAt: firebase.firestore.Timestamp.fromDate(exp), startAt: (m && m.startAt) || TS, redeemedCode: code, updatedAt: TS, note: (m && m.note) || "" }, { merge: true });
      return b.commit().then(function () { return { days: d.days, exp: exp }; });
    }).catch(function (e) { if (e && e.code === "permission-denied") throw new Error("الكود مش صالح أو استخدمته قبل كده."); throw e; });
  };

  window.TWINS_REDEEM_FORM = function (host, user, done) {
    host.insertAdjacentHTML("beforeend", '<div class="redeem"><b>🎟 عندك كود تفعيل؟</b><div><input class="rd-in" placeholder="PRO-XXXX-XXXX-XXXX" dir="ltr" autocomplete="off" maxlength="32"><button type="button" class="btn btn-primary btn-sm rd-go">فعّل</button></div><small class="rd-msg"></small></div>');
    var box = host.querySelector(".redeem:last-of-type") || host.lastElementChild, go = box.querySelector(".rd-go"), msg = box.querySelector(".rd-msg");
    go.onclick = function () {
      go.disabled = true; msg.textContent = "جاري التفعيل…";
      window.TWINS_REDEEM(user, box.querySelector(".rd-in").value).then(function (r) { msg.textContent = "✅ اتفعّلت عضوية PRO لمدة " + r.days + " يوم."; setTimeout(done, 900); })
        .catch(function (e) { msg.textContent = "❌ " + (e.message || "تعذّر التفعيل."); go.disabled = false; });
    };
  };

  document.addEventListener("click", function (e) {
    var im = e.target.closest && e.target.closest(".msg-img"); if (!im) return;
    var o = document.createElement("div"); o.className = "lightbox"; o.innerHTML = '<img alt="">'; o.firstChild.src = im.src;
    o.onclick = function () { o.remove(); }; document.body.appendChild(o);
  });
})();
