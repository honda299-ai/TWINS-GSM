/* TWINS GSM — Admin: images, media library, content CRUD, site settings */
(function (A) {
  "use strict";
  var $ = A.$, $$ = A.$$, esc = A.esc;

  /* =====================================================================
     رفع الصور بدون Firebase Storage:
     الصورة بتتصغّر وتتضغط (WebP) في المتصفح وبتتحفظ جوه مستند Firestore نفسه.
     ===================================================================== */

  var ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

  function imgFieldHtml(f) {
    return '<div class="form-field full"><label>' + esc(f.label) + '</label>' +
      '<div class="img-field" data-img="' + f.key + '">' +
        '<div class="img-preview' + (f.contain ? " contain" : "") + '"></div>' +
        '<div class="img-side">' +
          '<div class="img-btns">' +
            '<button type="button" class="btn btn-primary btn-sm" data-act="upload">⬆ رفع صورة</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-act="library">🖼 من المكتبة</button>' +
            '<button type="button" class="btn btn-danger btn-sm" data-act="remove">🗑 حذف الصورة</button>' +
          '</div>' +
          '<div class="img-url"><input type="url" dir="ltr" placeholder="أو الصق رابط صورة مباشر (https://…)" /><button type="button" class="btn btn-ghost btn-sm" data-act="useurl">استخدام</button></div>' +
          '<div class="img-meta"></div>' +
          (f.hint ? '<span class="hint">' + esc(f.hint) + '</span>' : "") +
          '<input type="file" accept="' + ACCEPT + '" hidden />' +
        '</div>' +
      '</div></div>';
  }

  function bindImg(form, f, value) {
    form._img = form._img || {};
    form._img[f.key] = value || "";
    var box = form.querySelector('[data-img="' + f.key + '"]');
    if (!box) return;
    var preview = $(".img-preview", box), meta = $(".img-meta", box), file = $('input[type=file]', box), urlIn = $(".img-url input", box);
    var rm = $('[data-act="remove"]', box);

    function paint(extra) {
      var v = form._img[f.key];
      preview.innerHTML = v ? '<img src="' + esc(v) + '" alt="" />' : "لا توجد صورة";
      rm.hidden = !v;
      meta.textContent = (v ? (v.indexOf("data:") === 0 ? "صورة مرفوعة · " + A.kb(A.bytesOf(v)) : "رابط خارجي") : "") + (extra || "");
    }
    function take(fileObj) {
      if (!fileObj) return;
      meta.textContent = "جاري الضغط…";
      A.compress(fileObj, f.opts).then(function (r) {
        form._img[f.key] = r.data;
        paint(" · \u200E" + r.w + "×" + r.h + " px");
      }).catch(function (e) { A.toast(e.message, true); paint(); });
    }

    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "upload") file.click();
      else if (act === "remove") { form._img[f.key] = ""; paint(); }
      else if (act === "library") A.pickMedia().then(function (d) { if (d) { form._img[f.key] = d; paint(); } });
      else if (act === "useurl") {
        var u = urlIn.value.trim();
        if (!/^https?:\/\/\S+$/i.test(u)) { A.toast("اكتب رابط صورة صحيح يبدأ بـ https://", true); return; }
        form._img[f.key] = u; urlIn.value = ""; paint();
      }
    });
    file.addEventListener("change", function () { take(file.files[0]); file.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) { box.addEventListener(ev, function (e) { e.preventDefault(); box.classList.add("drag"); }); });
    ["dragleave", "drop"].forEach(function (ev) { box.addEventListener(ev, function (e) { e.preventDefault(); box.classList.remove("drag"); }); });
    box.addEventListener("drop", function (e) { take(e.dataTransfer.files[0]); });
    paint();
  }

  /* ---------------- Media library ---------------- */

  function uploadMany(files, onProgress) {
    var list = Array.prototype.slice.call(files).filter(function (f) { return /^image\//.test(f.type); });
    var done = 0, added = [];
    if (!list.length) { A.toast("اختار صور (PNG / JPG / WebP).", true); return Promise.resolve(added); }
    return list.reduce(function (p, f) {
      return p.then(function () {
        return A.compress(f, { maxW: 1600, maxH: 1600, maxBytes: 280 * 1024 }).then(function (r) {
          return A.col("media").add({
            name: f.name.replace(/\.[^.]+$/, "").slice(0, 60), data: r.data, w: r.w, h: r.h, bytes: r.bytes,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }).then(function (ref) { added.push({ id: ref.id, data: r.data }); });
        }).catch(function (e) { A.toast(f.name + ": " + A.errMsg(e), true); })
          .then(function () { done++; if (onProgress) onProgress(done, list.length); });
      });
    }, Promise.resolve()).then(function () { return added; });
  }

  function loadMedia() {
    return A.col("media").orderBy("createdAt", "desc").limit(40).get().then(function (s) {
      return s.docs.map(function (d) { var x = d.data(); x._id = d.id; return x; });
    });
  }

  function mediaGridHtml(items, pick) {
    if (!items.length) return '<div class="empty-state">المكتبة فاضية. ارفع أول صورة.</div>';
    return '<div class="media-grid">' + items.map(function (m) {
      return '<div class="media-item' + (pick ? " pickable" : "") + '" data-id="' + esc(m._id) + '">' +
        '<img src="' + esc(m.data) + '" alt="" loading="lazy" />' +
        (pick ? "" : '<button type="button" class="icon-btn danger del" data-del="' + esc(m._id) + '" title="حذف">🗑</button>') +
        '<div class="cap"><span>' + esc(m.name || "صورة") + '</span><span>' + A.kb(m.bytes || A.bytesOf(m.data)) + '</span></div></div>';
    }).join("") + '</div>';
  }

  function dropZone(zone, input, run) {
    zone.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () { run(input.files); input.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add("drag"); }); });
    ["dragleave", "drop"].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove("drag"); }); });
    zone.addEventListener("drop", function (e) { run(e.dataTransfer.files); });
  }

  A.pickMedia = function () {
    return new Promise(function (resolve) {
      var box = A.modal.open('<h3>اختيار صورة من المكتبة</h3><p>اضغط على الصورة لاستخدامها، أو ارفع صور جديدة.</p>' +
        '<div class="media-drop" id="pmDrop"><b>⬆ اسحب الصور هنا أو اضغط للاختيار</b><span>بتتضغط تلقائياً قبل الحفظ</span>' +
        '<div class="progress" id="pmProg" hidden><i></i></div></div><input type="file" id="pmFile" accept="' + ACCEPT + '" multiple hidden />' +
        '<div id="pmGrid"><div class="empty-state">جاري التحميل…</div></div>' +
        '<div class="modal-actions" style="margin-top:16px"><button class="btn btn-ghost" data-close>إغلاق</button></div>', true);
      var settled = false;
      function finish(v) { if (settled) return; settled = true; A.modal.close(); A._modalCancel = null; resolve(v); }
      A._modalCancel = function () { finish(null); };
      var items = [];
      function draw() {
        $("#pmGrid", box).innerHTML = mediaGridHtml(items, true);
      }
      loadMedia().then(function (r) { items = r; draw(); }).catch(function (e) { $("#pmGrid", box).innerHTML = '<div class="empty-state">' + esc(A.errMsg(e)) + '</div>'; });
      $("[data-close]", box).onclick = function () { finish(null); };
      $("#pmGrid", box).addEventListener("click", function (e) {
        var it = e.target.closest(".media-item"); if (!it) return;
        var m = items.filter(function (x) { return x._id === it.getAttribute("data-id"); })[0];
        if (m) finish(m.data);
      });
      dropZone($("#pmDrop", box), $("#pmFile", box), function (files) {
        var prog = $("#pmProg", box); prog.hidden = false;
        uploadMany(files, function (d, t) { $("i", prog).style.width = Math.round(d / t * 100) + "%"; }).then(function (added) {
          if (added.length === 1) finish(added[0].data);
          else loadMedia().then(function (r) { items = r; draw(); prog.hidden = true; });
        });
      });
    });
  };

  A.views.media = function (root) {
    root.innerHTML = '<div class="panel-head"><div><h2>مكتبة الصور</h2><p>ارفع صورك هنا مرة واحدة واستخدمها في الأعمال والشعار وصورة الواجهة. الصور بتتضغط تلقائياً وبتتحفظ في Firestore — من غير Storage ومن غير دفع.</p></div></div>' +
      '<div class="media-drop" id="mDrop"><b>⬆ اسحب الصور هنا أو اضغط للاختيار</b><span>PNG / JPG / WebP — يمكنك اختيار أكتر من صورة</span><div class="progress" id="mProg" hidden><i></i></div></div>' +
      '<input type="file" id="mFile" accept="' + ACCEPT + '" multiple hidden />' +
      '<div class="pill warn" style="margin:0 0 14px;display:inline-block">حذف صورة من المكتبة لا يحذفها من عمل أو صفحة اتنشرت بيها — لحذفها من الموقع افتح العنصر واضغط «حذف الصورة».</div>' +
      '<div id="mGrid"><div class="empty-state">جاري التحميل…</div></div>';
    var items = [];
    function draw() { $("#mGrid").innerHTML = mediaGridHtml(items, false); }
    function reload() { return loadMedia().then(function (r) { items = r; draw(); }).catch(function (e) { $("#mGrid").innerHTML = '<div class="empty-state">' + esc(A.errMsg(e)) + '</div>'; }); }
    reload();
    dropZone($("#mDrop"), $("#mFile"), function (files) {
      var prog = $("#mProg"); prog.hidden = false; $("i", prog).style.width = "0";
      uploadMany(files, function (d, t) { $("i", prog).style.width = Math.round(d / t * 100) + "%"; }).then(function (added) {
        prog.hidden = true;
        if (added.length) A.toast("تم رفع " + added.length + " صورة");
        reload();
      });
    });
    $("#mGrid").addEventListener("click", function (e) {
      var b = e.target.closest("[data-del]"); if (!b) return;
      A.confirm("حذف الصورة؟", "هتتحذف من المكتبة نهائياً.", { ok: "حذف" }).then(function (ok) {
        if (!ok) return;
        A.col("media").doc(b.getAttribute("data-del")).delete().then(function () { A.toast("تم الحذف"); reload(); }).catch(function (er) { A.toast(A.errMsg(er), true); });
      });
    });
  };

  A._img = { fieldHtml: imgFieldHtml, bind: bindImg };
})(window.ADM);

/* =====================================================================
   Schema-driven content management (الأدوات، الأعمال، الخدمات …)
   ===================================================================== */
(function (A) {
  "use strict";
  var $ = A.$, $$ = A.$$, esc = A.esc;
  var D = window.TWINS_DATA || {};

  var ICONS = [["bolt", "⚡ صاعقة"], ["lock", "🔒 قفل"], ["globe", "🌐 عالم"], ["signal", "📶 شبكة"], ["laptop", "💻 لابتوب"], ["shield", "🛡 حماية"]];
  var ACTIVE = { key: "active", label: "ظاهر في الموقع (أوقفه لإخفائه بدون حذف)", type: "checkbox", full: true };
  var thumbImg = function (d) { return d.image ? '<img src="' + esc(d.image) + '" alt="" loading="lazy" />' : "🖼"; };

  var SCHEMAS = {
    proVault: {
      title: "محتوى PRO", desc: "أدوات وحسابات تظهر لأعضاء PRO النشطين فقط (محمية بقواعد Firestore). حط رابط التحميل الخاص + يوزر وباسورد لو لازم.",
      titleKey: "title", listTitle: function (d) { return d.title || "عنصر"; },
      listSub: function (d) { return [d.username ? "👤 " + d.username : "", d.url ? "🔗 رابط" : ""].filter(Boolean).join(" · ") || "—"; },
      fields: [
        { key: "title", label: "العنوان", type: "text", required: true, full: true },
        { key: "url", label: "رابط التحميل / الدخول (اختياري)", type: "text", full: true, ltr: true },
        { key: "username", label: "اليوزر", type: "text", ltr: true },
        { key: "password", label: "الباسورد", type: "text", ltr: true },
        { key: "notes", label: "ملاحظات للعضو", type: "textarea", full: true },
        ACTIVE
      ]
    },
    tools: {
      title: "الأدوات", desc: "الأدوات اللي الأعضاء بينزّلوها. ارفع الملف داخل مجلد tools/ مع الموقع، أو حط رابط تحميل مباشر (GitHub Releases / Google Drive / Mega).",
      titleKey: "name", listTitle: function (d) { return d.name || "أداة بدون اسم"; },
      listSub: function (d) { return [d.tag, d.version || "v1.0", d.size, d.file && d.file !== "#" ? "✓ فيه ملف" : "قريباً"].filter(Boolean).join(" · "); },
      fields: [
        { key: "name", label: "اسم الأداة", type: "text", required: true, full: true },
        { key: "desc", label: "الوصف", type: "textarea", full: true },
        { key: "category", label: "التصنيف", type: "ref", ref: "toolCategories" },
        { key: "tag", label: "الوسم على الكارت (مثلاً: جديد)", type: "text" },
        { key: "version", label: "الإصدار", type: "text", def: "v1.0" },
        { key: "size", label: "الحجم (مثلاً 18 MB)", type: "text" },
        { key: "file", label: "مسار الملف أو رابط التحميل", type: "text", full: true, ltr: true, hint: "مثال: tools/twins-frp-helper.zip — أو رابط مباشر https://… — اتركه فاضي أو # لتظهر «قريباً»." },
        { key: "hot", label: "أداة مميزة (تظهر بوسم برتقالي)", type: "checkbox" },
        ACTIVE
      ],
      validate: function (d) {
        d.file = d.file || "#";
        if (d.file !== "#" && !/^(https?:\/\/\S+|[a-zA-Z0-9_\-./]+)$/.test(d.file)) return "مسار الملف غير صحيح.";
        if (/^gs:\/\//i.test(d.file)) return "روابط gs:// مش مدعومة — استخدم مسار tools/ أو رابط مباشر.";
      }
    },
    works: {
      title: "معرض الأعمال", desc: "الأجهزة اللي أصلحتها. ارفع صورة لكل عمل (بتتضغط تلقائياً) وهتظهر على الموقع وتتفتح بالضغط عليها.",
      titleKey: "model", thumb: thumbImg, listTitle: function (d) { return d.model || "جهاز بدون اسم"; },
      listSub: function (d) { return [d.brand, d.category, d.image ? "📷 فيه صورة" : "بدون صورة"].filter(Boolean).join(" · "); },
      fields: [
        { key: "image", label: "صورة العمل", type: "image", opts: { maxW: 1000, maxH: 1000, maxBytes: 220 * 1024 }, hint: "الأفضل صورة أفقية أو مربعة. بتتصغّر لحد 1000px وبتتضغط تلقائياً." },
        { key: "brand", label: "البراند", type: "text", required: true },
        { key: "model", label: "الموديل", type: "text", required: true },
        { key: "category", label: "التصنيف", type: "ref", ref: "workCategories" },
        { key: "desc", label: "وصف الشغل", type: "textarea", full: true },
        ACTIVE
      ]
    },
    testimonials: {
      title: "آراء العملاء", desc: "كلام عملائك الحقيقي.", titleKey: "name",
      listTitle: function (d) { return d.name || "عميل"; }, listSub: function (d) { return "★".repeat(d.rating || 5) + "  " + (d.text || ""); },
      fields: [
        { key: "name", label: "الاسم", type: "text", required: true },
        { key: "role", label: "الصفة (مثلاً: عميل)", type: "text", def: "عميل" },
        { key: "rating", label: "التقييم", type: "select", options: [["5", "★★★★★ (5)"], ["4", "★★★★ (4)"], ["3", "★★★ (3)"]], def: "5", num: true },
        { key: "text", label: "الرأي", type: "textarea", required: true, full: true },
        ACTIVE
      ]
    },
    services: {
      title: "الخدمات والأسعار", desc: "كروت قسم الخدمات. السعر بيظهر للأعضاء المسجلين فقط.", titleKey: "title",
      listTitle: function (d) { return d.title || "خدمة بدون اسم"; }, listSub: function (d) { return (d.price ? d.price + " · " : "") + (d.desc || ""); },
      fields: [
        { key: "title", label: "عنوان الخدمة", type: "text", required: true, full: true },
        { key: "tag", label: "الوسم (مثلاً FRP)", type: "text" },
        { key: "icon", label: "الأيقونة", type: "select", options: ICONS, def: "bolt" },
        { key: "desc", label: "الوصف", type: "textarea", required: true, full: true },
        { key: "price", label: "السعر (مثلاً 150 ج.م)", type: "text" },
        { key: "priceNote", label: "ملاحظة السعر (مثلاً: حسب الموديل)", type: "text" },
        ACTIVE
      ]
    },
    steps: {
      title: "خطوات العمل", desc: "الخطوات الثلاثة في قسم «طريقة العمل».", titleKey: "title",
      listTitle: function (d) { return d.title || "خطوة"; }, listSub: function (d) { return d.desc || ""; },
      fields: [
        { key: "title", label: "العنوان", type: "text", required: true, full: true },
        { key: "desc", label: "الوصف", type: "textarea", required: true, full: true },
        ACTIVE
      ]
    },
    stats: {
      title: "الإحصائيات", desc: "الأرقام الظاهرة تحت الواجهة الرئيسية.", titleKey: "label",
      listTitle: function (d) { return d.value || "—"; }, listSub: function (d) { return d.label || ""; },
      fields: [
        { key: "value", label: "القيمة (مثلاً +502)", type: "text", required: true },
        { key: "label", label: "الوصف", type: "text", required: true },
        ACTIVE
      ]
    },
    faqs: {
      title: "الأسئلة الشائعة", desc: "الأسئلة والأجوبة في آخر الصفحة.", titleKey: "q",
      listTitle: function (d) { return d.q || "سؤال"; }, listSub: function (d) { return d.a || ""; },
      fields: [
        { key: "q", label: "السؤال", type: "text", required: true, full: true },
        { key: "a", label: "الإجابة", type: "textarea", required: true, full: true },
        ACTIVE
      ]
    },
    toolCategories: catSchema("تصنيفات الأدوات", "فلتر قسم الأدوات. «كل الأدوات» ثابت ومينفعش يتحذف.", "frp"),
    workCategories: catSchema("تصنيفات الأعمال", "فلتر معرض الأعمال. «كل الأعمال» ثابت ومينفعش يتحذف.", "iphone")
  };

  function catSchema(title, desc, ex) {
    return {
      title: title, desc: desc, titleKey: "label", protectId: "all",
      listTitle: function (d) { return d.label || "—"; }, listSub: function (d) { return "المعرّف: " + (d.id || "—"); },
      fields: [
        { key: "label", label: "الاسم الظاهر", type: "text", required: true },
        { key: "id", label: "المعرّف (إنجليزي بدون مسافات، مثلاً " + ex + ")", type: "text", required: true, ltr: true, lockOnEdit: true, hint: "بيتربط بالعناصر — مينفعش يتغير بعد الإنشاء." }
      ],
      validate: function (d, ctx) {
        if (!/^[a-z0-9_-]+$/.test(d.id)) return "المعرّف لازم حروف إنجليزية صغيرة وأرقام و - أو _ فقط.";
        if (!ctx.editing && ctx.docs.some(function (x) { return x.id === d.id; })) return "المعرّف ده مستخدم قبل كده.";
      }
    };
  }
  A.SCHEMAS = SCHEMAS;

  /* ---------- generic field renderer / reader ---------- */

  function fieldHtml(f, v, opts) {
    opts = opts || {};
    if (f.type === "image") return A._img.fieldHtml(f);
    var id = "f_" + f.key;
    var cls = "form-field" + (f.full ? " full" : "") + (f.type === "checkbox" ? " checkbox-field" : "");
    var dis = f.lockOnEdit && opts.editing ? " disabled" : "";
    var dir = f.ltr ? ' dir="ltr"' : "";
    var h = '<div class="' + cls + '">';
    if (f.type === "checkbox") {
      h += '<input type="checkbox" id="' + id + '"' + (v === true ? " checked" : "") + ' /><label for="' + id + '">' + esc(f.label) + '</label>';
    } else {
      h += '<label for="' + id + '">' + esc(f.label) + (f.required ? " *" : "") + '</label>';
      if (f.type === "textarea") {
        h += '<textarea id="' + id + '"' + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : "") + '>' + esc(v) + '</textarea>';
      } else if (f.type === "select" || f.type === "ref") {
        var options = f.type === "ref" ? ((opts.refs && opts.refs[f.ref]) || []).map(function (c) { return [c.id, c.label]; }) : f.options;
        var found = options.some(function (o) { return String(o[0]) === String(v); });
        if (v && !found) options = options.concat([[v, v]]);
        h += '<select id="' + id + '"' + dis + '>' + (f.type === "ref" ? '<option value="">— بدون تصنيف —</option>' : "") +
          options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? " selected" : "") + '>' + esc(o[1]) + '</option>'; }).join("") + '</select>';
      } else if (f.type === "color") {
        var hex = /^#[0-9a-f]{6}$/i.test(v) ? v : (f.def || "#ff7a1a");
        h += '<div class="color-row"><input type="color" id="' + id + '_c" value="' + esc(hex) + '" /><input type="text" id="' + id + '" dir="ltr" value="' + esc(v || "") + '" placeholder="' + esc(f.def || "") + '" /></div>' +
          '<div class="swatches">' + ["#ff7a1a", "#2f9bff", "#22c55e", "#a855f7", "#ef4444", "#ec4899", "#eab308", "#14b8a6"].map(function (c) { return '<button type="button" data-swatch="' + c + '" data-for="' + f.key + '" style="background:' + c + '" aria-label="' + c + '"></button>'; }).join("") + '</div>';
      } else {
        h += '<input type="' + (f.type === "number" ? "number" : "text") + '" id="' + id + '"' + dir + dis + ' value="' + esc(v == null ? "" : v) + '"' + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : "") + ' />';
      }
      if (f.hint) h += '<span class="hint">' + esc(f.hint) + '</span>';
    }
    return h + "</div>";
  }

  function readField(form, f) {
    if (f.type === "image") return (form._img && form._img[f.key]) || "";
    var el = $("#f_" + f.key, form);
    if (!el) return f.type === "checkbox" ? false : "";
    if (f.type === "checkbox") return el.checked;
    if (f.type === "number") return Number(el.value || 0);
    var v = el.value.trim();
    if (f.num && v !== "") return Number(v);
    return v;
  }

  function bindColors(form) {
    form.addEventListener("input", function (e) {
      var t = e.target;
      if (t.id && /_c$/.test(t.id) && t.type === "color") { var tx = $("#" + t.id.replace(/_c$/, ""), form); if (tx) tx.value = t.value; }
      else if (t.id && t.type === "text") { var c = $("#" + t.id + "_c", form); if (c && /^#[0-9a-f]{6}$/i.test(t.value)) c.value = t.value; }
    });
    form.addEventListener("click", function (e) {
      var b = e.target.closest("[data-swatch]"); if (!b) return;
      var k = b.getAttribute("data-for"), c = b.getAttribute("data-swatch");
      $("#f_" + k, form).value = c; $("#f_" + k + "_c", form).value = c;
    });
  }

  A.field = { html: fieldHtml, read: readField, bindColors: bindColors };

  /* ---------- Collection view ---------- */

  function collectionView(name) {
    return function (root) {
      var S = SCHEMAS[name];
      var docs = [], q = "";
      var defaults = D[name] && D[name].length ? D[name].length : 0;

      root.innerHTML =
        '<div class="panel-head"><div><h2>' + esc(S.title) + ' <span class="pill" id="countPill"></span></h2><p>' + esc(S.desc) + '</p></div>' +
        '<div class="head-actions"><button class="btn btn-primary btn-sm" type="button" id="addBtn">+ إضافة جديد</button></div></div>' +
        '<form class="form-card" id="itemForm" hidden><h3 id="formTitle"></h3><div class="form-grid" id="formFields"></div>' +
        '<div class="form-actions"><button class="btn btn-primary" type="submit" id="submitBtn">حفظ</button><button class="btn btn-ghost" type="button" id="cancelBtn">إلغاء</button></div></form>' +
        '<div class="toolbar"><label class="search-box"><span aria-hidden="true">⌕</span><input type="search" id="listSearch" placeholder="بحث…" /></label></div>' +
        '<div class="item-list" id="itemList"><div class="empty-state">جاري التحميل…</div></div>';

      var form = $("#itemForm");

      function nextOrder() { return docs.reduce(function (m, d) { return Math.max(m, d.order || 0); }, 0) + 1; }

      function draw() {
        $("#countPill").textContent = docs.length;
        var list = $("#itemList");
        if (!docs.length) {
          list.innerHTML = '<div class="empty-state">' + (defaults
            ? 'الموقع بيعرض دلوقتي المحتوى الافتراضي (' + defaults + ' عنصر) من ملف data.js.<br>استورده هنا عشان تقدر تعدّل وتحذف وترتّب كل عنصر.<br><button class="btn btn-primary btn-sm" type="button" id="seedBtn">⤓ استيراد المحتوى الحالي للتعديل</button>'
            : 'مفيش عناصر لسه. اضغط «إضافة جديد».') + '</div>';
          var sb = $("#seedBtn"); if (sb) sb.onclick = doSeed;
          return;
        }
        var shown = docs.filter(function (d) { return !q || (S.listTitle(d) + " " + S.listSub(d)).toLowerCase().indexOf(q) > -1; });
        if (!shown.length) { list.innerHTML = '<div class="empty-state">مفيش نتائج للبحث.</div>'; return; }
        list.innerHTML = shown.map(function (d) {
          var i = docs.indexOf(d), prot = S.protectId && d.id === S.protectId;
          return '<div class="item-row' + (d.active === false ? " is-hidden" : "") + '" data-id="' + esc(d._id) + '">' +
            (S.thumb ? '<div class="item-thumb">' + S.thumb(d) + '</div>' : "") +
            '<div class="item-main"><b>' + esc(S.listTitle(d)) + (d.active === false ? '<span class="pill warn">مخفي</span>' : "") + (d.hot ? '<span class="pill new">مميز</span>' : "") + '</b><small>' + esc(S.listSub(d)) + '</small></div>' +
            '<div class="item-actions">' +
            '<button class="icon-btn" data-a="up" title="لأعلى"' + (i === 0 || q ? " disabled" : "") + '>▲</button>' +
            '<button class="icon-btn" data-a="down" title="لأسفل"' + (i === docs.length - 1 || q ? " disabled" : "") + '>▼</button>' +
            (S.fields.some(function (f) { return f.key === "active"; }) ? '<button class="icon-btn" data-a="toggle" title="' + (d.active === false ? "إظهار" : "إخفاء") + '">' + (d.active === false ? "🙈" : "👁") + '</button>' : "") +
            (prot ? "" : '<button class="icon-btn" data-a="dup" title="نسخ">⧉</button>') +
            '<button class="icon-btn" data-a="edit" title="تعديل">✎</button>' +
            (prot ? "" : '<button class="icon-btn danger" data-a="del" title="حذف">🗑</button>') + '</div></div>';
        }).join("");
      }

      function reload() {
        return A.list(name).then(function (r) { docs = r; draw(); }).catch(function (e) { $("#itemList").innerHTML = '<div class="empty-state">' + esc(A.errMsg(e)) + '</div>'; });
      }

      function doSeed() {
        var b = $("#seedBtn"); if (b) { b.disabled = true; b.textContent = "جاري الاستيراد…"; }
        A.seed([name], false).then(function (n) { A.toast("تم استيراد " + n + " عنصر"); return reload(); }).catch(function (e) { A.toast(A.errMsg(e), true); });
      }

      function openForm(doc) {
        var refFields = S.fields.filter(function (f) { return f.type === "ref"; });
        Promise.all(refFields.map(function (f) { return A.list(f.ref).then(function (l) { return [f.ref, (l.length ? l : (D[f.ref] || [])).filter(function (c) { return c.id !== "all"; })]; }); }))
          .then(function (pairs) {
            var refs = {}; pairs.forEach(function (p) { refs[p[0]] = p[1]; });
            form.hidden = false; form.dataset.id = doc ? doc._id : ""; form._img = {};
            $("#formTitle").textContent = doc ? "تعديل: " + S.listTitle(doc) : "إضافة جديد";
            $("#submitBtn").textContent = doc ? "حفظ التعديلات" : "إضافة";
            $("#formFields").innerHTML = S.fields.map(function (f) {
              var v = doc ? doc[f.key] : f.def;
              if (f.key === "active") v = doc ? doc.active !== false : true;
              if (f.type === "checkbox" && v == null) v = false;
              if (f.type === "select" && v != null) v = String(v);
              return fieldHtml(f, v == null ? "" : v, { refs: refs, editing: !!doc });
            }).join("");
            S.fields.forEach(function (f) { if (f.type === "image") A._img.bind(form, f, doc ? doc[f.key] : ""); });
            form.scrollIntoView({ behavior: "smooth", block: "start" });
          });
      }

      $("#addBtn").onclick = function () {
        if (!docs.length && defaults) {
          var box = A.modal.open('<h3>استورد المحتوى الحالي الأول؟</h3><p>الموقع بيعرض دلوقتي ' + defaults + ' عنصر افتراضي. لو أضفت عنصر جديد من غير استيراد، الموقع هيعرض العناصر اللي ضفتها بس وتختفي الافتراضية.</p>' +
            '<div class="modal-actions"><button class="btn btn-primary" data-s>استيراد ثم إضافة</button><button class="btn btn-ghost" data-n>إضافة بدون استيراد</button></div>');
          $("[data-s]", box).onclick = function () { A.modal.close(); A.seed([name], false).then(function () { return reload(); }).then(function () { openForm(null); }); };
          $("[data-n]", box).onclick = function () { A.modal.close(); openForm(null); };
          return;
        }
        openForm(null);
      };
      $("#cancelBtn").onclick = function () { form.hidden = true; };
      $("#listSearch").addEventListener("input", function () { q = this.value.trim().toLowerCase(); draw(); });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var id = form.dataset.id, data = {}, missing = "";
        S.fields.forEach(function (f) {
          var v = readField(form, f);
          if (f.required && (v === "" || v == null) && !missing) missing = f.label;
          data[f.key] = v;
        });
        if (missing) { A.toast("حقل مطلوب: " + missing, true); return; }
        var msg = S.validate && S.validate(data, { editing: !!id, docs: docs });
        if (msg) { A.toast(msg, true); return; }
        var btn = $("#submitBtn"); btn.disabled = true;
        var task;
        if (id) task = A.col(name).doc(id).set(data, { merge: true });
        else { data.order = nextOrder(); task = A.col(name).add(data); }
        task.then(function () { A.toast(id ? "تم حفظ التعديلات" : "تمت الإضافة"); form.hidden = true; return reload(); })
          .catch(function (er) { A.toast(A.errMsg(er), true); })
          .then(function () { btn.disabled = false; });
      });

      $("#itemList").addEventListener("click", function (e) {
        var b = e.target.closest("[data-a]"); if (!b) return;
        var row = b.closest(".item-row"), id = row.getAttribute("data-id");
        var doc = docs.filter(function (d) { return d._id === id; })[0]; if (!doc) return;
        var act = b.getAttribute("data-a");
        if (act === "edit") openForm(doc);
        else if (act === "toggle") A.col(name).doc(id).update({ active: doc.active === false }).then(reload).catch(function (er) { A.toast(A.errMsg(er), true); });
        else if (act === "dup") {
          var copy = Object.assign({}, doc); delete copy._id; copy.order = nextOrder();
          if (S.titleKey && copy[S.titleKey]) copy[S.titleKey] += " (نسخة)";
          if (S.protectId) copy.id = (copy.id || "cat") + "-copy";
          A.col(name).add(copy).then(function () { A.toast("تم النسخ"); return reload(); }).catch(function (er) { A.toast(A.errMsg(er), true); });
        } else if (act === "del") {
          A.confirm("حذف «" + S.listTitle(doc) + "»؟", "العملية دي مينفعش التراجع عنها.", { ok: "حذف" }).then(function (ok) {
            if (ok) A.col(name).doc(id).delete().then(function () { A.toast("تم الحذف"); return reload(); }).catch(function (er) { A.toast(A.errMsg(er), true); });
          });
        } else if (act === "up" || act === "down") {
          var i = docs.indexOf(doc), j = act === "up" ? i - 1 : i + 1;
          if (j < 0 || j >= docs.length) return;
          var arr = docs.slice(); arr.splice(i, 1); arr.splice(j, 0, doc);
          var ops = [];
          arr.forEach(function (d, k) { if (d.order !== k + 1) ops.push({ type: "set", merge: true, ref: A.col(name).doc(d._id), data: { order: k + 1 } }); });
          A.batchRun(ops, 400).then(reload).catch(function (er) { A.toast(A.errMsg(er), true); });
        }
      });

      reload();
    };
  }

  Object.keys(SCHEMAS).forEach(function (n) { A.views[n] = collectionView(n); });
})(window.ADM);

/* =====================================================================
   Site settings — كل نصوص الموقع وألوانه وصوره وظهور أقسامه
   ===================================================================== */
(function (A) {
  "use strict";
  var $ = A.$, $$ = A.$$, esc = A.esc;
  var D = window.TWINS_DATA || {};

  function sec(id, label, tit, sub) {
    return [
      { sep: label },
      { key: "sec_" + id + "_label", label: "العنوان الصغير", type: "text", ph: tit[0] },
      { key: "sec_" + id + "_title", label: "العنوان الكبير", type: "text", ph: tit[1], full: true },
      { key: "sec_" + id + "_sub", label: "الوصف", type: "textarea", ph: sub, full: true }
    ];
  }
  var concat = function () { return Array.prototype.concat.apply([], arguments); };

  var TABS = [
    { id: "brand", label: "🎨 الهوية", fields: [
      { sep: "الاسم والشعار" },
      { key: "brand_first", label: "الاسم — الجزء الأول", type: "text", ph: "TWINS" },
      { key: "brand_second", label: "الاسم — الجزء الملوّن", type: "text", ph: "GSM" },
      { key: "brand_tagline", label: "الجملة الصغيرة تحت الاسم", type: "text", ph: "SOFTWARE & NETWORK SOLUTIONS", full: true },
      { key: "logo", label: "الشعار (Logo)", type: "image", contain: true, opts: { maxW: 400, maxH: 400, maxBytes: 90 * 1024 }, hint: "الأفضل PNG مربع بخلفية شفافة. بيظهر في الهيدر والفوتر والموبايل." },
      { key: "favicon", label: "أيقونة التبويب (Favicon)", type: "image", contain: true, opts: { maxW: 128, maxH: 128, maxBytes: 30 * 1024 }, hint: "لو سبتها فاضية هنستخدم الشعار." },
      { sep: "اللون" },
      { key: "color_primary", label: "اللون الأساسي للموقع", type: "color", def: "#ff7a1a", full: true, hint: "بيغيّر الأزرار والعناوين الملونة والتدرجات في الموقع كله." }
    ] },
    { id: "home", label: "🏠 الصفحة الرئيسية", fields: [
      { sep: "شريط الإعلان (أعلى الموقع)" },
      { key: "announce_on", label: "إظهار شريط الإعلان", type: "checkbox", full: true },
      { key: "announce_text", label: "نص الإعلان", type: "text", ph: "🔥 عرض خاص: خصم 20% على فك الحمايات", full: true },
      { key: "announce_link", label: "رابط عند الضغط (اختياري)", type: "text", ltr: true, ph: "https://wa.me/…", full: true },
      { sep: "الواجهة الرئيسية (Hero)" },
      { key: "hero_eyebrow", label: "الشارة الصغيرة", type: "text", ph: "متخصصون في السوفت وير والـ GSM", full: true },
      { key: "hero_title1", label: "العنوان — السطر الأول", type: "text", ph: "نعيد جهازك" },
      { key: "hero_title2", label: "العنوان — السطر الملوّن", type: "text", ph: "للحياة من جديد" },
      { key: "hero_lead", label: "الفقرة التعريفية", type: "textarea", full: true, ph: "من الشاشة السوداء والـ Bootloop لفك الحمايات وإصلاح الشبكة…" },
      { key: "hero_cta1", label: "نص الزر الرئيسي", type: "text", ph: "ابدأ طلبك الآن" },
      { key: "hero_cta2", label: "نص الزر الثانوي", type: "text", ph: "شاهد أعمالنا" },
      { key: "hero_trust_num", label: "رقم الثقة", type: "text", ph: "+502" },
      { key: "hero_trust_text", label: "نص الثقة", type: "text", ph: "جهاز تم إصلاحه بنجاح" },
      { key: "hero_trust_sub", label: "سطر الثقة الصغير", type: "text", ph: "ثقة عملائنا في كل مكان", full: true },
      { key: "hero_visual", label: "الشكل الجانبي في الواجهة", type: "select", options: [["phone", "الموبايل التفاعلي (الافتراضي)"], ["image", "صورة مخصصة"]], def: "phone", full: true },
      { key: "hero_image", label: "الصورة المخصصة (لو اخترتها فوق)", type: "image", opts: { maxW: 1000, maxH: 1100, maxBytes: 300 * 1024 } }
    ] },
    { id: "sections", label: "🧩 العناوين والنصوص", fields: concat(
      [{ sep: "القائمة العلوية" },
        { key: "nav_services", label: "رابط الخدمات", type: "text", ph: "الخدمات" },
        { key: "nav_work", label: "رابط الأعمال", type: "text", ph: "أعمالنا" },
        { key: "nav_tools", label: "رابط الأدوات", type: "text", ph: "الأدوات" },
        { key: "nav_reviews", label: "رابط الآراء", type: "text", ph: "الآراء" },
        { key: "nav_contact", label: "رابط التواصل", type: "text", ph: "تواصل معنا" },
        { key: "header_cta", label: "زر الواتساب في الهيدر", type: "text", ph: "كلمنا واتساب" }],
      sec("services", "قسم الخدمات", ["SERVICES / خدماتنا", "كل ما يخص السوفت وير في مكان واحد"], "حلول دقيقة لكل عطل…"),
      sec("process", "قسم طريقة العمل", ["HOW WE WORK / طريقة العمل", "ثلاث خطوات وجهازك يرجع يشتغل"], "لا تنتظر كتير… تواصل، نشخّص، ونبدأ الحل فوراً."),
      sec("work", "قسم الأعمال", ["PORTFOLIO / معرض الأعمال", "شغل حقيقي… ونتائج موثقة"], "نماذج من الأجهزة اللي تعاملنا معها…"),
      sec("tools", "قسم الأدوات", ["TOOLS / أدواتنا", "التول بتاعتنا… جاهزة للتحميل"], "أدوات وملفات نستخدمها في الشغل…"),
      [{ key: "gate_title", label: "عنوان بوابة الأعضاء", type: "text", ph: "التحميل للأعضاء المسجلين فقط" },
        { key: "gate_text", label: "نص بوابة الأعضاء", type: "text", ph: "سجّل الدخول أو اعمل حساب جديد…" }],
      sec("reviews", "قسم آراء العملاء", ["TESTIMONIALS / آراء العملاء", "كلام الناس… أصدق من أي إعلان"], "آراء حقيقية من عملائنا بعد استلام أجهزتهم."),
      [{ key: "review_cta_title", label: "عنوان دعوة المشاركة", type: "text", ph: "استخدمت خدمتنا؟" },
        { key: "review_cta_text", label: "نص دعوة المشاركة", type: "text", ph: "يسعدنا نسمع رأيك ونضيفه هنا." },
        { key: "review_cta_btn", label: "زر المشاركة", type: "text", ph: "شاركنا رأيك" }],
      sec("faq", "قسم الأسئلة الشائعة", ["FAQ / أسئلة شائعة", "عندك سؤال؟ إحنا جاوبنا"], "ولو لقيت سؤالك مش موجود، كلّمنا مباشرة على واتساب."),
      [{ key: "faq_cta", label: "زر الأسئلة", type: "text", ph: "اسألنا الآن" }]
    ) },
    { id: "visibility", label: "👁 الأقسام والظهور", fields: [
      { sep: "إظهار / إخفاء أقسام الصفحة الرئيسية" },
      { key: "show_stats", label: "شريط الإحصائيات", type: "checkbox", defOn: true },
      { key: "show_services", label: "الخدمات", type: "checkbox", defOn: true },
      { key: "show_process", label: "طريقة العمل", type: "checkbox", defOn: true },
      { key: "show_work", label: "معرض الأعمال", type: "checkbox", defOn: true },
      { key: "show_tools", label: "الأدوات", type: "checkbox", defOn: true },
      { key: "show_reviews", label: "آراء العملاء", type: "checkbox", defOn: true },
      { key: "show_faq", label: "الأسئلة الشائعة", type: "checkbox", defOn: true },
      { key: "show_contact", label: "التواصل", type: "checkbox", defOn: true },
      { sep: "زر واتساب العائم" },
      { key: "float_wa_on", label: "إظهار زر واتساب العائم", type: "checkbox", defOn: true },
      { key: "float_wa_text", label: "نص الزر (على الكمبيوتر)", type: "text", ph: "كلمنا واتساب" }
    ] },
    { id: "contact", label: "✆ التواصل", fields: [
      { sep: "بيانات التواصل" },
      { key: "phoneDisplay", label: "الرقم الظاهر", type: "text", doc: "contact", ltr: true, ph: "+20 100 000 0000", required: true },
      { key: "whatsapp", label: "رقم أو رابط واتساب", type: "text", doc: "contact", ltr: true, full: true, required: true, hint: "اكتب الرقم (مثال 201012345678 أو 01012345678) أو الصق رابط wa.me — وهنكوّن الرابط الصحيح تلقائياً." },
      { key: "waMessage", label: "الرسالة الجاهزة عند فتح واتساب", type: "text", doc: "contact", full: true, ph: "السلام عليكم، عندي جهاز محتاج صيانة سوفت وير" },
      { key: "email", label: "الإيميل", type: "text", doc: "contact", ltr: true },
      { key: "facebook", label: "رابط فيسبوك", type: "text", doc: "contact", ltr: true, ph: "https://facebook.com/…" },
      { key: "tiktok", label: "رابط تيك توك", type: "text", doc: "contact", ltr: true, ph: "https://tiktok.com/@…" },
      { key: "instagram", label: "رابط إنستغرام", type: "text", doc: "contact", ltr: true, ph: "https://instagram.com/…" },
      { sep: "قسم التواصل في الصفحة" },
      { key: "sec_contact_label", label: "العنوان الصغير", type: "text", ph: "CONTACT / تواصل معنا" },
      { key: "contact_title1", label: "العنوان — السطر الأول", type: "text", ph: "جهازك محتاج حل؟" },
      { key: "contact_title2", label: "العنوان — السطر الملوّن", type: "text", ph: "إحنا هنا" },
      { key: "contact_lead", label: "الفقرة", type: "textarea", full: true, ph: "ابعثلنا نوع الجهاز ووصف المشكلة على واتساب…" },
      { key: "contact_cta", label: "نص الزر", type: "text", ph: "ابدأ محادثة واتساب" }
    ] },
    { id: "seo", label: "🔎 SEO والفوتر", fields: [
      { sep: "محركات البحث ومشاركة الروابط" },
      { key: "seo_title", label: "عنوان الموقع (Title)", type: "text", full: true, ph: "TWINS GSM | حلول السوفت وير والشبكات" },
      { key: "seo_description", label: "وصف الموقع (Description)", type: "textarea", full: true, ph: "TWINS GSM — مركز متخصص في صيانة سوفت وير الموبايلات…", hint: "يفضّل بين 120 و160 حرف." },
      { key: "seo_image", label: "رابط صورة المشاركة (واتساب / فيسبوك)", type: "text", ltr: true, full: true, hint: "لازم رابط كامل https://… لصورة 1200×630 (مثلاً ارفع og.jpg مع ملفات الموقع). الصور المرفوعة من اللوحة مبتظهرش في المعاينة." },
      { sep: "الفوتر" },
      { key: "footer_copy", label: "نص الحقوق", type: "text", ph: "كل الحقوق محفوظة." },
      { key: "footer_note", label: "الجملة الأخيرة", type: "text", ph: "صُنع بحب للشغل الصح 💛" }
    ] }
  ];

  function normWa(raw, msg) {
    var link = String(raw || "").trim();
    if (/^\+?[\d\s()\-]{7,}$/.test(link)) {
      var digits = link.replace(/\D/g, "");
      if (/^0[^0]/.test(digits)) digits = "20" + digits.slice(1);   // رقم مصري محلي → دولي
      if (digits.indexOf("00") === 0) digits = digits.slice(2);
      link = "https://wa.me/" + digits;
    }
    if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)/i.test(link) && msg && link.indexOf("text=") === -1) {
      link += (link.indexOf("?") > -1 ? "&" : "?") + "text=" + encodeURIComponent(msg);
    }
    return link;
  }

  A.views.settings = function (root) {
    Promise.all([A.db.doc("site/settings").get(), A.db.doc("site/contact").get()]).then(function (r) {
      var S = r[0].exists ? r[0].data() : {};
      var C = Object.assign({}, D.contact || {}, r[1].exists ? r[1].data() : {});
      var all = [];
      TABS.forEach(function (t) { t.fields.forEach(function (f) { if (f.key) all.push(f); }); });

      function valueOf(f) {
        var src = f.doc === "contact" ? C : S;
        if (f.type === "checkbox") return f.defOn ? src[f.key] !== false : src[f.key] === true;
        return src[f.key] == null ? "" : src[f.key];
      }

      root.innerHTML = '<div class="panel-head"><div><h2>إعدادات الموقع</h2><p>كل نص أو لون أو صورة في الموقع تقدر تغيّرها من هنا. أي خانة تسيبها فاضية الموقع هيستخدم النص الافتراضي (الظاهر باهت داخل الخانة).</p></div></div>' +
        '<form id="settingsForm"><div class="tabs" id="setTabs">' + TABS.map(function (t, i) { return '<button type="button" data-tab="' + t.id + '" class="' + (i ? "" : "active") + '">' + t.label + '</button>'; }).join("") + '</div>' +
        TABS.map(function (t, i) {
          return '<div class="form-card" data-panel="' + t.id + '"' + (i ? " hidden" : "") + '><div class="form-grid">' +
            t.fields.map(function (f) { return f.sep ? '<div class="group-title">' + esc(f.sep) + '</div>' : A.field.html(f, valueOf(f)); }).join("") +
            '</div><div class="form-actions"><button type="button" class="btn btn-ghost btn-sm" data-reset="' + t.id + '">↺ استعادة الافتراضي لهذا التبويب</button></div></div>';
        }).join("") +
        '<div class="savebar"><span>التعديلات بتظهر على الموقع فور الحفظ.</span><a class="btn btn-ghost btn-sm" href="index.html" target="_blank" rel="noopener">معاينة ↗</a><button class="btn btn-primary" type="submit" id="saveSettings">💾 حفظ كل التغييرات</button></div></form>';

      var form = $("#settingsForm");
      form._img = {};
      all.forEach(function (f) { if (f.type === "image") A._img.bind(form, f, valueOf(f)); });
      A.field.bindColors(form);

      $("#setTabs").addEventListener("click", function (e) {
        var b = e.target.closest("[data-tab]"); if (!b) return;
        $$("#setTabs button").forEach(function (x) { x.classList.toggle("active", x === b); });
        $$("[data-panel]", form).forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== b.getAttribute("data-tab"); });
      });

      form.addEventListener("click", function (e) {
        var b = e.target.closest("[data-reset]"); if (!b) return;
        var tab = TABS.filter(function (t) { return t.id === b.getAttribute("data-reset"); })[0];
        A.confirm("استعادة الافتراضي؟", "هيتم تفريغ خانات التبويب ده (ما عدا بيانات التواصل). مش هيتحفظ غير لما تضغط «حفظ».", { ok: "استعادة", danger: false }).then(function (ok) {
          if (!ok) return;
          tab.fields.forEach(function (f) {
            if (!f.key || f.doc === "contact") return;
            if (f.type === "image") { form._img[f.key] = ""; var im = $('[data-img="' + f.key + '"] [data-act="remove"]', form); if (im) im.click(); }
            else if (f.type === "checkbox") $("#f_" + f.key, form).checked = !!f.defOn;
            else if (f.type === "select") $("#f_" + f.key, form).value = f.def || "";
            else $("#f_" + f.key, form).value = "";
          });
          A.toast("اتفرّغ التبويب — اضغط «حفظ» لتأكيد العملية");
        });
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var del = firebase.firestore.FieldValue.delete();
        var s = {}, c = {}, bad = "";
        all.forEach(function (f) {
          var v = A.field.read(form, f);
          var target = f.doc === "contact" ? c : s;
          if (f.doc === "contact") {
            if (f.required && !v) bad = bad || f.label;
            target[f.key] = v;
          } else if (f.type === "checkbox") target[f.key] = v;
          else target[f.key] = v === "" ? del : v;
        });
        if (bad) { A.toast("حقل مطلوب: " + bad, true); return; }
        ["facebook", "tiktok", "instagram"].forEach(function (k) {
          if (c[k] && c[k] !== "#" && !/^https?:\/\//i.test(c[k])) bad = bad || ("الرابط لازم يبدأ بـ https:// (" + k + ")");
        });
        if (s.announce_link && s.announce_link !== del && !/^(https?:\/\/|#|\/)/i.test(s.announce_link)) bad = bad || "رابط الإعلان لازم يبدأ بـ https://";
        if (s.color_primary && s.color_primary !== del && !/^#[0-9a-f]{6}$/i.test(s.color_primary)) bad = bad || "اللون لازم بصيغة #RRGGBB";
        if (s.seo_image && s.seo_image !== del && !/^https?:\/\//i.test(s.seo_image)) bad = bad || "رابط صورة المشاركة لازم يبدأ بـ https://";
        if (bad) { A.toast(bad, true); return; }
        c.whatsapp = normWa(c.whatsapp, c.waMessage);

        var btn = $("#saveSettings"); btn.disabled = true; btn.textContent = "جاري الحفظ…";
        Promise.all([A.db.doc("site/settings").set(s, { merge: true }), A.db.doc("site/contact").set(c, { merge: true })])
          .then(function () { A.toast("✓ تم الحفظ — الموقع اتحدّث"); $("#f_whatsapp", form).value = c.whatsapp; })
          .catch(function (er) { A.toast(A.errMsg(er), true); })
          .then(function () { btn.disabled = false; btn.textContent = "💾 حفظ كل التغييرات"; });
      });
    }).catch(function (e) { root.innerHTML = '<div class="empty-state">' + esc(A.errMsg(e)) + '</div>'; });
  };
})(window.ADM);
