/* TWINS GSM — Member area */
(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var auth = null;
  var db = null;
  var mode = "login";
  var toastTimer = null;
  var statusTimer = null;
  var PRIMARY_ADMIN = "hondastore299@gmail.com";

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function safeHref(url) {
    var raw = String(url == null ? "" : url).trim();
    if (!raw) return "#";
    if (/^(https?:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(raw)) return raw;
    if (/^[a-zA-Z0-9_\-./]+$/.test(raw)) return raw;
    return "#";
  }

  function toast(msg) {
    var el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3200);
  }

  function setStatus(msg, type) {
    var el = $("#authStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "auth-status " + (type || "info");
    el.hidden = !msg;
    clearTimeout(statusTimer);
    if (msg) statusTimer = setTimeout(function () { el.hidden = true; }, 6000);
  }

  function showError(msg) {
    var el = $("#authError");
    if (!el) return;
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  function fmt(ts) {
    if (!ts) return "—";
    try {
      var d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
    } catch (e) { return "—"; }
  }

  function setLoading(isLoading) {
    var submit = $("#authSubmit");
    if (!submit) return;
    submit.disabled = isLoading;
    submit.classList.toggle("loading", isLoading);
    var label = submit.querySelector(".btn-label");
    if (label) label.textContent = isLoading ? "جارٍ التنفيذ..." : (mode === "register" ? "إنشاء الحساب" : "دخول");
  }

  function setMode(next) {
    mode = next === "register" ? "register" : "login";
    $$("#authTabs button").forEach(function (b) {
      var active = b.getAttribute("data-mode") === mode;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
    });
    $("#nameField").hidden = mode !== "register";
    $("#authPassword").setAttribute("autocomplete", mode === "register" ? "new-password" : "current-password");
    $("#authTitle").textContent = mode === "register" ? "إنشاء حساب جديد" : "تسجيل الدخول";
    $("#authSubtitle").textContent = mode === "register"
      ? "أنشئ حسابك للوصول إلى الأسعار والأدوات وطلبات الصيانة."
      : "أدخل بياناتك للوصول إلى منطقة الأعضاء.";
    $("#authAltText").textContent = mode === "register" ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟";
    $("#authAltBtn").textContent = mode === "register" ? "سجّل الدخول" : "أنشئ حسابًا جديدًا";
    $("#forgotBtn").style.visibility = mode === "register" ? "hidden" : "visible";
    showError("");
    setStatus("", "info");
    setLoading(false);
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function friendlyAuthError(err) {
    var code = err && err.code ? err.code : "";
    var map = {
      "auth/invalid-credential": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      "auth/invalid-email": "صيغة البريد الإلكتروني غير صحيحة.",
      "auth/user-not-found": "لا يوجد حساب بهذا البريد الإلكتروني.",
      "auth/wrong-password": "كلمة المرور غير صحيحة.",
      "auth/email-already-in-use": "هذا البريد الإلكتروني مستخدم بالفعل. جرّب تسجيل الدخول.",
      "auth/weak-password": "كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.",
      "auth/too-many-requests": "محاولات كثيرة جدًا. انتظر قليلًا ثم حاول مرة أخرى.",
      "auth/network-request-failed": "تعذر الاتصال. تأكد من الإنترنت وحاول مرة أخرى.",
      "auth/operation-not-allowed": "تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في Firebase.",
      "auth/invalid-api-key": "إعدادات Firebase غير صحيحة. راجع firebase-config.js.",
      "auth/unauthorized-domain": "هذا الدومين غير مصرح به في إعدادات Firebase Authentication."
    };
    return map[code] || (err && err.message ? err.message : "حدث خطأ غير متوقع. حاول مرة أخرى.");
  }

  function configLooksReal() {
    var c = window.TWINS_FIREBASE_CONFIG || {};
    var bad = /YOUR_|your-project|000000000000|XXXX|example/i;
    return !!(c.apiKey && c.projectId && c.appId && !bad.test(c.apiKey) && !bad.test(c.projectId) && !bad.test(c.appId));
  }

  function init() {
    bindUi();

    if (!window.firebase) {
      showError("تعذر تحميل Firebase. تأكد من الاتصال بالإنترنت وأن السكربتات غير محجوبة.");
      disableAuth("خدمة الدخول غير متاحة حاليًا.");
      return;
    }
    if (!configLooksReal()) {
      showError("إعدادات Firebase غير مكتملة. عدّل ملف firebase-config.js ثم أعد المحاولة.");
      disableAuth("إعداد Firebase مطلوب.");
      return;
    }

    try {
      var app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.TWINS_FIREBASE_CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
      try { auth.languageCode = "ar"; } catch (e) {}
    } catch (e) {
      showError("خطأ في تهيئة Firebase: " + (e && e.message ? e.message : "غير معروف"));
      disableAuth("تعذر تهيئة الدخول.");
      return;
    }

    auth.onAuthStateChanged(function (user) {
      if (user) {
        $("#authView").hidden = true;
        $("#accountView").hidden = false;
        loadDashboard(user);
      } else {
        $("#authView").hidden = false;
        $("#accountView").hidden = true;
        var adminBtn = $("#goAdminBtn");
        if (adminBtn) adminBtn.remove();
        setLoading(false);
      }
    }, function (err) {
      showError(friendlyAuthError(err));
    });
  }

  function disableAuth(msg) {
    var submit = $("#authSubmit");
    if (submit) { submit.disabled = true; submit.querySelector(".btn-label").textContent = "غير متاح"; }
    setStatus(msg, "info");
  }

  function bindUi() {
    // يسمح برابط account.html?mode=register من زر "إنشاء حساب" في الرئيسية
    var requestedMode = "";
    try { requestedMode = new URLSearchParams(window.location.search).get("mode") || ""; } catch (e) { /* متصفحات قديمة */ }
    setMode(requestedMode === "register" ? "register" : "login");

    $("#authTabs").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-mode]");
      if (btn) setMode(btn.getAttribute("data-mode"));
    });

    $("#authAltBtn").addEventListener("click", function () {
      setMode(mode === "register" ? "login" : "register");
    });

    $("#passwordToggle").addEventListener("click", function () {
      var input = $("#authPassword");
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      this.textContent = show ? "إخفاء" : "إظهار";
      this.setAttribute("aria-label", show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
      input.focus();
    });

    $("#forgotBtn").addEventListener("click", handleForgotPassword);
    $("#authForm").addEventListener("submit", handleAuthSubmit);
    $("#logoutBtn").addEventListener("click", function () {
      if (auth) auth.signOut().catch(function (err) { toast(friendlyAuthError(err)); });
    });

    $("#requestForm").addEventListener("submit", handleRequestSubmit);

    document.addEventListener("click", function (e) {
      var link = e.target.closest("[data-tool]");
      if (!link || !auth || !auth.currentUser || !db) return;
      var href = link.getAttribute("href") || "#";
      if (href === "#") return;
      db.collection("downloads").add({
        uid: auth.currentUser.uid,
        email: auth.currentUser.email || "",
        toolName: link.getAttribute("data-tool") || "أداة",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function () { /* لا تعطل التحميل */ });
    });
  }

  function handleAuthSubmit(e) {
    e.preventDefault();
    showError("");
    setStatus("", "info");

    if (!auth) { showError("خدمة الدخول غير جاهزة. أعد تحميل الصفحة."); return; }

    var email = ($("#authEmail").value || "").trim().toLowerCase();
    var password = $("#authPassword").value || "";
    var name = ($("#authName").value || "").trim();

    if (!email) { showError("أدخل البريد الإلكتروني."); $("#authEmail").focus(); return; }
    if (!validateEmail(email)) { showError("أدخل بريدًا إلكترونيًا صحيحًا."); $("#authEmail").focus(); return; }
    if (!password) { showError("أدخل كلمة المرور."); $("#authPassword").focus(); return; }
    if (password.length < 6) { showError("كلمة المرور يجب أن تكون 6 أحرف على الأقل."); $("#authPassword").focus(); return; }
    if (mode === "register" && name.length > 60) { showError("الاسم طويل جدًا."); $("#authName").focus(); return; }

    setLoading(true);

    var task;
    if (mode === "register") {
      task = auth.createUserWithEmailAndPassword(email, password).then(function (cred) {
        var user = cred.user;
        var profileName = name || (email === PRIMARY_ADMIN ? "Honda Store" : email.split("@")[0]);
        var userRole = "member";
        var ops = [];
        if (user && user.sendEmailVerification) user.sendEmailVerification().catch(function () {});
        if (user && user.updateProfile) ops.push(user.updateProfile({ displayName: profileName }));
        if (db && user) {
          ops.push(db.collection("users").doc(user.uid).set({
            email: user.email || email,
            name: profileName,
            role: userRole,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true }));
        }
        return Promise.all(ops).then(function () {
          setStatus("تم إنشاء الحساب بنجاح.", "success");
        });
      });
    } else {
      task = auth.signInWithEmailAndPassword(email, password).then(function () {
        setStatus("تم تسجيل الدخول بنجاح.", "success");
      });
    }

    task.catch(function (err) {
      showError(friendlyAuthError(err));
    }).then(function () {
      setLoading(false);
    });
  }

  function handleForgotPassword() {
    showError("");
    if (!auth) { showError("خدمة الدخول غير جاهزة."); return; }
    var email = ($("#authEmail").value || "").trim().toLowerCase();
    if (!email || !validateEmail(email)) {
      showError("اكتب بريدك الإلكتروني أولًا لإرسال رابط إعادة تعيين كلمة المرور.");
      $("#authEmail").focus();
      return;
    }
    var btn = $("#forgotBtn");
    btn.disabled = true;
    auth.sendPasswordResetEmail(email).then(function () {
      setStatus("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.", "success");
    }).catch(function (err) {
      showError(friendlyAuthError(err));
    }).then(function () {
      btn.disabled = false;
    });
  }

  function injectAdminBadgeAndButton(user, displayName) {
    var email = (user.email || "").toLowerCase();
    var isPrimary = email === PRIMARY_ADMIN;

    var checkAdmin = isPrimary
      ? Promise.resolve(true)
      : (db ? db.collection("admins").doc(email).get().then(function (d) { return d.exists && d.data().active !== false; }).catch(function () { return false; }) : Promise.resolve(false));

    checkAdmin.then(function (isAdmin) {
      if (!isAdmin) return;

      $("#profileName").innerHTML = esc(displayName) + ' <span class="status done" style="margin-inline-start:6px">Admin 👑</span>';
      var logoutBtn = $("#logoutBtn");
      if (logoutBtn && !$("#goAdminBtn")) {
        var adminLink = document.createElement("a");
        adminLink.id = "goAdminBtn";
        adminLink.href = "admin.html";
        adminLink.className = "btn btn-primary btn-sm";
        adminLink.style.marginInlineEnd = "8px";
        adminLink.textContent = "لوحة التحكم ⚙";
        logoutBtn.parentNode.insertBefore(adminLink, logoutBtn);
      }
      if (db && isPrimary) {
        db.collection("users").doc(user.uid).set({ role: "admin" }, { merge: true }).catch(function () {});
      }
    });
  }

  function loadDashboard(user) {
    var email = user.email || "";
    var isPrimary = email.toLowerCase() === PRIMARY_ADMIN;
    var displayName = user.displayName || (isPrimary ? "Honda Store" : (email ? email.split("@")[0] : "عضو TWINS"));
    $("#accountEmail").textContent = email;
    $("#profileEmail").textContent = email;
    $("#profileLetter").textContent = (displayName || email || "T").charAt(0).toUpperCase();
    $("#profileName").textContent = displayName;

    injectAdminBadgeAndButton(user, displayName);

    if (!db) return;

    db.collection("users").doc(user.uid).get().then(function (doc) {
      if (doc.exists && doc.data().name) {
        var savedName = doc.data().name;
        $("#profileName").textContent = savedName;
        injectAdminBadgeAndButton(user, savedName);
      }
    }).catch(function () {});

    loadServices();
    loadTools();
    loadRequests();
    loadDownloads();
  }

  function loadServices() {
    if (!db) return;
    db.collection("services").get().then(function (snap) {
      var rows = snap.docs.map(function (d) {
        var s = d.data() || {};
        if (typeof s.order !== "number") s.order = 999;
        return s;
      }).filter(function (s) { return s.active !== false; }).sort(function (a, b) { return a.order - b.order; });

      $("#reqService").innerHTML = rows.map(function (s) {
        return '<option value="' + esc(s.title || "خدمة") + '">' + esc(s.title || "خدمة") + '</option>';
      }).join("") || '<option value="صيانة عامة">صيانة عامة</option>';

      $("#priceTable").innerHTML = rows.length ? ('<tr><th>الخدمة</th><th>النوع</th><th>السعر</th></tr>' + rows.map(function (s) {
        return '<tr><td>' + esc(s.title || "—") + '</td><td>' + esc(s.tag || "—") + '</td>' +
          '<td><b>' + esc(s.price || "بعد التواصل") + '</b>' +
          (s.priceNote ? '<br><small style="color:var(--muted-2)">' + esc(s.priceNote) + '</small>' : '') + '</td></tr>';
      }).join("")) : '<tr><td colspan="3" class="mini-empty">لا توجد أسعار مضافة حاليًا.</td></tr>';
    }).catch(function () {
      $("#priceTable").innerHTML = '<tr><td colspan="3" class="mini-empty">تعذر تحميل الأسعار حاليًا.</td></tr>';
    });
  }

  function loadTools() {
    if (!db) return;
    db.collection("tools").get().then(function (snap) {
      var tools = snap.docs.map(function (d) { return d.data() || {}; })
        .filter(function (t) { return t.active !== false; })
        .sort(function (a, b) { return (typeof a.order === "number" ? a.order : 999) - (typeof b.order === "number" ? b.order : 999); });
      $("#memberTools").innerHTML = tools.map(function (t) {
        var file = safeHref(t.file);
        var ready = file && file !== "#";
        return '<div class="mini-row"><div><b>' + esc(t.name || "أداة") + '</b><small>' +
          esc(t.version || "v1.0") + ' · ' + esc(t.size || "—") + '</small></div>' +
          (ready ? '<a href="' + esc(file) + '" download rel="noopener noreferrer" data-tool="' + esc(t.name || "أداة") + '">تحميل ↓</a>' : '<span class="status">قريبًا</span>') +
          '</div>';
      }).join("") || '<div class="mini-empty">لا توجد أدوات متاحة حاليًا.</div>';
    }).catch(function () {
      $("#memberTools").innerHTML = '<div class="mini-empty">تعذر تحميل الأدوات.</div>';
    });
  }

  function handleRequestSubmit(e) {
    e.preventDefault();
    var user = auth && auth.currentUser;
    if (!user || !db) return;
    var btn = $("#requestSubmit");
    var device = ($("#reqDevice").value || "").trim();
    var note = ($("#reqNote").value || "").trim();
    if (device.length < 2) { toast("اكتب نوع الجهاز بشكل واضح."); return; }
    btn.disabled = true;
    db.collection("requests").add({
      uid: user.uid,
      email: user.email || "",
      service: $("#reqService").value || "صيانة عامة",
      device: device,
      note: note,
      status: "جديد",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      $("#reqDevice").value = "";
      $("#reqNote").value = "";
      toast("تم إرسال الطلب بنجاح.");
      loadRequests();
    }).catch(function (err) {
      toast("تعذر إرسال الطلب: " + friendlyAuthError(err));
    }).then(function () { btn.disabled = false; });
  }

  function loadRequests() {
    var user = auth && auth.currentUser;
    if (!user || !db) return;
    db.collection("requests").where("uid", "==", user.uid).get().then(function (snap) {
      var docs = snap.docs.map(function (d) { var r = d.data() || {}; r._id = d.id; return r; });
      docs.sort(function (a, b) {
        var ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
        var tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
      $("#myRequests").innerHTML = docs.map(function (r) {
        var done = r.status === "تم التنفيذ";
        return '<div class="mini-row"><div><b>' + esc(r.device || "جهاز") + ' — ' + esc(r.service || "خدمة") + '</b>' +
          '<small>' + esc(r.note || "بدون ملاحظات") + ' · ' + fmt(r.createdAt) + '</small></div>' +
          '<span class="status' + (done ? ' done' : '') + '">' + esc(r.status || "جديد") + '</span></div>';
      }).join("") || '<div class="mini-empty">لا توجد طلبات حتى الآن.</div>';
      updateSummary(docs.length, null);
    }).catch(function () {
      $("#myRequests").innerHTML = '<div class="mini-empty">تعذر تحميل الطلبات. قد تحتاج لتفعيل فهرس Firestore.</div>';
    });
  }

  var summaryState = { requests: 0, downloads: 0 };
  function updateSummary(requests, downloads) {
    if (typeof requests === "number") summaryState.requests = requests;
    if (typeof downloads === "number") summaryState.downloads = downloads;
    $("#accountSummary").innerHTML =
      '<div class="mini-row"><div><b>الطلبات</b><small>إجمالي طلبات الصيانة</small></div><span class="status">' + summaryState.requests + '</span></div>' +
      '<div class="mini-row"><div><b>التحميلات</b><small>إجمالي تحميلات الأدوات</small></div><span class="status">' + summaryState.downloads + '</span></div>';
  }

  function loadDownloads() {
    var user = auth && auth.currentUser;
    if (!user || !db) return;
    db.collection("downloads").where("uid", "==", user.uid).get().then(function (snap) {
      var docs = snap.docs.map(function (d) { return d.data() || {}; });
      docs.sort(function (a, b) {
        var ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
        var tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
      $("#myDownloads").innerHTML = docs.map(function (r) {
        return '<div class="mini-row"><div><b>' + esc(r.toolName || "أداة") + '</b><small>' + fmt(r.createdAt) + '</small></div></div>';
      }).join("") || '<div class="mini-empty">لا توجد تحميلات بعد.</div>';
      updateSummary(null, docs.length);
    }).catch(function () {
      $("#myDownloads").innerHTML = '<div class="mini-empty">تعذر تحميل سجل التحميلات.</div>';
      updateSummary(null, 0);
    });
  }

  init();
})();

/* Google sign-in */
(function () {
  var b = document.getElementById("googleBtn");
  if (!b || !window.firebase) return;
  b.addEventListener("click", function () {
    var auth = firebase.auth(), db = firebase.firestore(), p = new firebase.auth.GoogleAuthProvider();
    var err = document.getElementById("authError");
    function show(m) { if (err) { err.textContent = m; err.hidden = !m; } }
    show("");
    auth.signInWithPopup(p).then(function (cred) {
      var u = cred.user, ref = db.collection("users").doc(u.uid);
      return ref.get().then(function (d) {
        if (d.exists) return;
        return ref.set({ email: u.email || "", name: u.displayName || (u.email || "").split("@")[0], role: "member", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      });
    }).catch(function (e) {
      if (e && (e.code === "auth/popup-blocked")) return auth.signInWithRedirect(p);
      if (e && e.code === "auth/popup-closed-by-user") return;
      show(e && e.code === "auth/operation-not-allowed" ? "فعّل Google من Firebase Console ← Authentication." : "تعذّر الدخول بحساب Google.");
    });
  });
})();
