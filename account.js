/* TWINS GSM — Member area */
(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var auth, db;
  var mode = "login";
  var toastTimer = null;

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3200);
  }

  function showError(msg) {
    var el = $("#authError");
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  function fmt(ts) {
    if (!ts) return "—";
    try { return ts.toDate ? ts.toDate().toLocaleString("ar-EG") : new Date(ts).toLocaleString("ar-EG"); }
    catch (e) { return "—"; }
  }

  function init() {
    if (!window.firebase || !window.TWINS_FIREBASE_CONFIG) {
      showError("Firebase مش محمّل — تأكد من الاتصال بالإنترنت.");
      return;
    }
    try {
      var app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.TWINS_FIREBASE_CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
    } catch (e) {
      showError("خطأ في الإعداد: " + e.message);
      return;
    }

    $("#authTabs").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-mode]");
      if (!btn) return;
      mode = btn.getAttribute("data-mode");
      $$("#authTabs button").forEach(function (b) { b.classList.toggle("active", b === btn); });
      $("#nameField").hidden = mode !== "register";
      $("#authSubmit").textContent = mode === "register" ? "إنشاء حساب ←" : "دخول ←";
      showError("");
    });

    $("#authForm").addEventListener("submit", function (e) {
      e.preventDefault();
      showError("");
      var email = $("#authEmail").value.trim();
      var password = $("#authPassword").value;
      var name = $("#authName").value.trim();
      var btn = $("#authSubmit");
      btn.disabled = true;

      var task = mode === "register"
        ? auth.createUserWithEmailAndPassword(email, password).then(function (cred) {
            var user = cred.user;
            var profile = name ? { displayName: name } : null;
            var write = profile ? user.updateProfile(profile) : Promise.resolve();
            return write.then(function () {
              return db.collection("users").doc(user.uid).set({
                email: user.email,
                name: name || email.split("@")[0],
                role: "member",
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            });
          })
        : auth.signInWithEmailAndPassword(email, password);

      task.catch(function (err) {
        var map = {
          "auth/invalid-credential": "الإيميل أو كلمة المرور غلط.",
          "auth/email-already-in-use": "الإيميل ده مستخدم بالفعل — سجّل الدخول بدل كده.",
          "auth/weak-password": "كلمة المرور ضعيفة — استخدم 6 حروف على الأقل.",
          "auth/too-many-requests": "محاولات كتير، حاول بعد شوية."
        };
        showError(map[err.code] || err.message);
      }).then(function () {
        btn.disabled = false;
      });
    });

    $("#logoutBtn").addEventListener("click", function () { auth.signOut(); });

    $("#requestForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var user = auth.currentUser;
      if (!user) return;
      var btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      db.collection("requests").add({
        uid: user.uid,
        email: user.email,
        service: $("#reqService").value,
        device: $("#reqDevice").value.trim(),
        note: $("#reqNote").value.trim(),
        status: "جديد",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function () {
        $("#reqDevice").value = "";
        $("#reqNote").value = "";
        toast("تم إرسال الطلب");
        loadRequests();
      }).catch(function (err) { toast("خطأ: " + err.message); })
        .then(function () { btn.disabled = false; });
    });

    auth.onAuthStateChanged(function (user) {
      if (user) {
        $("#authView").hidden = true;
        $("#accountView").hidden = false;
        loadDashboard(user);
      } else {
        $("#authView").hidden = false;
        $("#accountView").hidden = true;
      }
    });
  }

  function loadDashboard(user) {
    $("#accountEmail").textContent = user.email || "";
    $("#profileEmail").textContent = user.email || "";
    $("#profileLetter").textContent = (user.email || "T").charAt(0).toUpperCase();
    $("#profileName").textContent = user.displayName || (user.email || "").split("@")[0] || "عضو TWINS";

    db.collection("users").doc(user.uid).get().then(function (doc) {
      if (doc.exists && doc.data().name) $("#profileName").textContent = doc.data().name;
    }).catch(function () {});

    db.collection("services").get().then(function (snap) {
      var rows = snap.docs.map(function (d) {
        var s = d.data() || {};
        if (typeof s.order !== "number") s.order = 999;
        return s;
      }).sort(function (a, b) { return a.order - b.order; });

      $("#reqService").innerHTML = rows.map(function (s) {
        return '<option value="' + esc(s.title) + '">' + esc(s.title) + '</option>';
      }).join("") || '<option value="صيانة عامة">صيانة عامة</option>';

      $("#priceTable").innerHTML = rows.map(function (s) {
        return '<tr><td>' + esc(s.title) + '</td><td>' + esc(s.tag || "—") + '</td>' +
          '<td><b>' + esc(s.price || "بعد التواصل") + '</b>' +
          (s.priceNote ? '<br><small style="color:var(--muted-2)">' + esc(s.priceNote) + '</small>' : '') + '</td></tr>';
      }).join("") || '<tr><td colspan="3" class="mini-empty">لسه مفيش أسعار مضافة.</td></tr>';
    }).catch(function () {});

    db.collection("tools").get().then(function (snap) {
      var tools = snap.docs.map(function (d) { return d.data() || {}; });
      $("#memberTools").innerHTML = tools.map(function (t) {
        var ready = t.file && t.file !== "#";
        return '<div class="mini-row"><div><b>' + esc(t.name) + '</b><small>' +
          esc(t.version || "v1.0") + ' · ' + esc(t.size || "—") + '</small></div>' +
          (ready ? '<a href="' + esc(t.file) + '" download data-tool="' + esc(t.name) + '">تحميل ↓</a>' : '<span class="status">قريباً</span>') +
          '</div>';
      }).join("") || '<div class="mini-empty">لسه مفيش أدوات.</div>';
    }).catch(function () {});

    loadRequests();
    loadDownloads();
  }

  function loadRequests() {
    var user = auth.currentUser;
    if (!user) return;
    db.collection("requests").where("uid", "==", user.uid).orderBy("createdAt", "desc").get()
      .then(function (snap) {
        $("#myRequests").innerHTML = snap.docs.map(function (d) {
          var r = d.data() || {};
          var done = r.status === "تم التنفيذ";
          return '<div class="mini-row"><div><b>' + esc(r.device || "جهاز") + ' — ' + esc(r.service || "خدمة") + '</b>' +
            '<small>' + esc(r.note || "") + ' · ' + fmt(r.createdAt) + '</small></div>' +
            '<span class="status' + (done ? ' done' : '') + '">' + esc(r.status || "جديد") + '</span></div>';
        }).join("") || '<div class="mini-empty">مفيش طلبات لسه.</div>';
      }).catch(function () {
        $("#myRequests").innerHTML = '<div class="mini-empty">مفيش طلبات لسه.</div>';
      });
  }

  function loadDownloads() {
    var user = auth.currentUser;
    if (!user) return;
    db.collection("downloads").where("uid", "==", user.uid).orderBy("createdAt", "desc").get()
      .then(function (snap) {
        $("#myDownloads").innerHTML = snap.docs.map(function (d) {
          var r = d.data() || {};
          return '<div class="mini-row"><div><b>' + esc(r.toolName || "أداة") + '</b><small>' + fmt(r.createdAt) + '</small></div></div>';
        }).join("") || '<div class="mini-empty">لسه مفيش تحميلات.</div>';

        $("#accountSummary").innerHTML =
          '<div class="mini-row"><div><b>عدد التحميلات</b><small>خلال كل الوقت</small></div><span class="status">' + snap.size + '</span></div>';
      }).catch(function () {
        $("#myDownloads").innerHTML = '<div class="mini-empty">لسه مفيش تحميلات.</div>';
      });
  }

  document.addEventListener("click", function (e) {
    var link = e.target.closest("[data-tool]");
    if (!link || !auth || !auth.currentUser) return;
    db.collection("downloads").add({
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      toolName: link.getAttribute("data-tool"),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function () {});
  });

  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  init();
})();
