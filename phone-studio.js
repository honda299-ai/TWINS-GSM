/* ============================================================
   TWINS GSM — Phone Studio
   هاتف تفاعلي داخل الموقع: جهات اتصال، مكالمات محاكاة، رسائل،
   سجل، إعدادات + أزرار تحويل للتطبيقات الحقيقية على الموبايل.
   ============================================================ */
(function () {
  "use strict";

  var D = window.TWINS_DATA || {};
  var $ = function (id) { return document.getElementById(id); };
  var root = $("phoneStudio");
  if (!root) return;

  var KEY = {
    contacts: "twins_phone_contacts_v1",
    recents: "twins_phone_recents_v1",
    messages: "twins_phone_messages_v1",
    settings: "twins_phone_settings_v1"
  };

  var defaultSettings = { sound: true, vibrate: true, menu: true, replies: true, large: false, accent: "#ff8a1f" };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* تخزين اختياري */ }
  }
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function digitsOf(v) { return String(v == null ? "" : v).replace(/[^\d+]/g, ""); }
  function initials(name) {
    var parts = String(name || "TG").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "TG";
    return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }
  function nowTime() {
    var d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function durationText(sec) {
    var s = Math.max(0, Math.floor(sec || 0));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  var siteWa = String((D.contact || {}).whatsapp || "#");
  function waFor(phone, text) {
    var num = digitsOf(phone).replace(/\+/g, "");
    var msg = encodeURIComponent(text || "السلام عليكم، محتاج مساعدة من TWINS GSM");
    if (num && num.length >= 8) return "https://wa.me/" + num + "?text=" + msg;
    if (!siteWa || siteWa === "#") return "#";
    return siteWa + (siteWa.indexOf("?") > -1 ? "&" : "?") + "text=" + msg;
  }

  /* ================= البيانات ================= */

  var S = Object.assign({}, defaultSettings, read(KEY.settings, {}));
  var baseContacts = Array.isArray(D.phoneContacts) && D.phoneContacts.length
    ? D.phoneContacts.map(function (c, i) {
        return {
          id: c.id || ("default-" + i), name: c.name || "بدون اسم", role: c.role || "جهة اتصال",
          phone: c.phone || "", fav: !!c.fav, team: c.team !== false, custom: false,
          color: c.color || "#ff8a1f"
        };
      })
    : [{ id: "twins-main", name: "TWINS GSM", role: "الرقم الرئيسي", phone: (D.contact || {}).phoneDisplay || "", fav: true, team: true, custom: false, color: "#ff8a1f" }];

  var storedContacts = read(KEY.contacts, null);
  var contacts = Array.isArray(storedContacts) ? storedContacts.slice() : baseContacts.map(function (c) { return Object.assign({}, c); });

  var recentsRaw = read(KEY.recents, []);
  var recents = Array.isArray(recentsRaw) ? recentsRaw.slice(0, 60) : [];
  var messages = read(KEY.messages, {}) || {};

  function persistContacts() { write(KEY.contacts, contacts); }
  function persistRecents() { write(KEY.recents, recents); }
  function persistMessages() { write(KEY.messages, messages); }
  function persistSettings() { write(KEY.settings, S); }

  var replies = D.phoneReplies || {};
  var menuReplies = replies.menu || {};
  var welcomeText = replies.welcome || "أهلاً بك في TWINS GSM 👋";
  var chatDefault = replies.chatDefault || "اكتب نوع الجهاز والمشكلة وهنرد عليك.";
  var chatRules = Array.isArray(replies.chat) ? replies.chat : [];

  function chatReply(text) {
    var t = String(text || "").toLowerCase();
    for (var i = 0; i < chatRules.length; i++) {
      var rule = chatRules[i] || {};
      if (rule.test && new RegExp(rule.test, "i").test(t)) return rule.text || chatDefault;
    }
    return chatDefault;
  }

  /* ================= الصوت والاهتزاز ================= */

  var audioCtx = null;
  function tone(freq, ms, gainValue) {
    if (!S.sound) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === "suspended") audioCtx.resume();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = gainValue || 0.04;
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (ms / 1000));
      osc.stop(audioCtx.currentTime + (ms / 1000) + 0.02);
    } catch (e) { /* الصوت اختياري */ }
  }
  function buzz(pattern) {
    if (!S.vibrate || !navigator.vibrate) return;
    // المتصفحات تمنع الاهتزاز قبل أول لمسة حقيقية من المستخدم.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try { navigator.vibrate(pattern); } catch (e) { /* تجاهل */ }
  }

  var ringTimer = null;
  function startRing() {
    stopRing();
    if (!S.sound) return;
    var play = function () { tone(720, 260, 0.035); setTimeout(function () { tone(540, 300, 0.03); }, 290); };
    play();
    ringTimer = setInterval(play, 1400);
  }
  function stopRing() { if (ringTimer) { clearInterval(ringTimer); ringTimer = null; } }

  /* =================الحالة================= */

  var state = {
    open: false,
    screen: "dialer",
    digits: "",
    filter: "all",
    conv: null,
    call: null,
    incoming: null,
    lastFocus: null
  };

  var els = {};
  function initEls() {
    [
      "psClock", "psDevice", "psTabs", "psBody", "psDialAvatar", "psDialName", "psDialNumber", "psDialHint",
      "psKeypad", "psBackspace", "psCallBtn", "psDialContacts", "psDemoIncoming", "psRealCall",
      "psContactSearch", "psContactFilters", "psContactList", "psAddContact",
      "psRecentList", "psClearRecents", "psConversations", "psChat", "psChatBack", "psChatTitle",
      "psChatAvatar", "psChatMessages", "psChatForm", "psChatInput",
      "psSetSound", "psSetVibrate", "psSetMenu", "psSetReplies", "psSetLarge", "psAccents", "psReset", "psYear",
      "psCall", "psCallMin", "psCallAvatar", "psCallName", "psCallNumber", "psCallState", "psCallTimer",
      "psCallTranscript", "psCallPad", "psCallPadKeys", "psMute", "psKeypadToggle", "psSpeaker", "psEndCall",
      "psIncoming", "psIncomingAvatar", "psIncomingName", "psIncomingNumber", "psDecline", "psAccept",
      "psSheet", "psSheetCard", "psToast"
    ].forEach(function (id) { els[id] = $(id); });
  }

  /* ================= التنبيهات ================= */

  var toastTimer = null;
  function toast(text) {
    if (!els.psToast) return;
    els.psToast.textContent = text;
    els.psToast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.psToast.hidden = true; }, 2600);
  }

  /* ================= الشاشات ================= */

  function showScreen(name) {
    state.screen = name;
    $$('[data-screen]', els.psTabs).forEach(function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-screen") === name ? "true" : "false");
    });
    $$('[data-panel]', els.psBody).forEach(function (p) {
      p.hidden = p.getAttribute("data-panel") !== name;
    });
    $$('.mobile-dock [data-open-phone]').forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-open-phone") === name);
    });
    if (name === "contacts") renderContacts();
    if (name === "recents") renderRecents();
    if (name === "messages") renderConversations();
    if (name === "settings") syncSettingsUI();
    var panel = $('[data-panel="' + name + '"]', els.psBody);
    if (panel) panel.scrollTop = 0;
  }

  function $$(sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); }

  function open(screen) {
    if (!root) return;
    state.lastFocus = document.activeElement;
    root.hidden = false;
    state.open = true;
    document.body.style.overflow = "hidden";
    showScreen(screen || "dialer");
    updateClock();
    setTimeout(function () { if (els.psDevice) els.psDevice.querySelector(".ps-close").focus(); }, 60);
  }
  function close() {
    if (!state.open) return;
    endCall(true);
    root.hidden = true;
    state.open = false;
    document.body.style.overflow = "";
    closeSheet();
    if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus();
  }

  function updateClock() {
    if (els.psClock) els.psClock.textContent = nowTime();
  }
  setInterval(updateClock, 20000);

  /* ================= لوحة الأرقام ================= */

  var keypadDefs = [
    ["1", ""], ["2", "ABC"], ["3", "DEF"],
    ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
    ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
    ["*", ""], ["0", "+"], ["#", ""]
  ];
  function keypadHtml() {
    return keypadDefs.map(function (k) {
      return '<button type="button" class="ps-key" data-key="' + k[0] + '" aria-label="' + k[0] + '"><b>' + k[0] + '</b><small>' + k[1] + '</small></button>';
    }).join("");
  }
  function buildKeypads() {
    if (els.psKeypad) els.psKeypad.innerHTML = keypadHtml();
    if (els.psCallPadKeys) els.psCallPadKeys.innerHTML = keypadHtml();
  }

  function findContact(number) {
    var d = digitsOf(number).replace(/\+/g, "");
    if (!d) return null;
    for (var i = 0; i < contacts.length; i++) {
      var cnum = digitsOf(contacts[i].phone).replace(/\+/g, "");
      if (cnum && (cnum === d || cnum.slice(-9) === d.slice(-9))) return contacts[i];
    }
    return null;
  }
  function activeTarget() {
    var d = state.digits.trim();
    if (!d) return contacts[0] || { name: "TWINS GSM", phone: (D.contact || {}).phoneDisplay || "", color: "#ff8a1f" };
    var m = findContact(d);
    if (m) return m;
    return { name: "رقم جديد", role: "اتصال تجريبي", phone: d, color: "#8e95a4", custom: true };
  }

  function updateDial() {
    var d = state.digits;
    var target = activeTarget();
    els.psDialName.textContent = target.name;
    els.psDialName.classList.toggle("is-number", !d);
    els.psDialNumber.textContent = d || target.phone || "—";
    els.psDialHint.textContent = d
      ? (findContact(d) ? "جهة اتصال معروفة — اضغط زر الاتصال للتجربة" : "مفيش جهة اتصال بهذا الرقم — هتظهر كمكالمة تجريبية")
      : "اكتب رقم أو اختر جهة اتصال وابدأ المكالمة التجريبية";
    els.psDialAvatar.textContent = initials(target.name);
    els.psDialAvatar.style.background = "linear-gradient(140deg," + (target.color || "#ff8a1f") + ",rgba(var(--ps-accent-rgb),.35))";
  }

  function pressDigit(key, inCall) {
    if (inCall) { ivr(key); return; }
    if (state.digits.length >= 22) return;
    state.digits += key;
    tone(440 + (parseInt(key, 10) || 0) * 35, 70, 0.02);
    buzz(12);
    updateDial();
  }

  /* ================= المكالمة ================= */

  function addTranscript(text, cls, link) {
    if (!els.psCallTranscript) return;
    var div = document.createElement("div");
    div.className = "ps-msg " + (cls || "in");
    div.textContent = text;
    els.psCallTranscript.appendChild(div);
    if (link) {
      var a = document.createElement("a");
      a.className = "ps-call-link";
      a.textContent = link.label;
      a.href = link.href;
      if (link.external !== false) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      a.addEventListener("click", function () { if (link.action) link.action(); });
      els.psCallTranscript.appendChild(a);
    }
    els.psCallTranscript.scrollTop = els.psCallTranscript.scrollHeight;
  }

  function setCallUI(target, phase) {
    els.psCallName.textContent = target.name || "TWINS GSM";
    els.psCallNumber.textContent = target.phone || "—";
    els.psCallAvatar.textContent = initials(target.name);
    els.psCallAvatar.style.background = "linear-gradient(140deg," + (target.color || "#ff8a1f") + ",rgba(var(--ps-accent-rgb),.4))";
    els.psCall.classList.toggle("is-ringing", phase === "ringing");
    els.psCall.classList.toggle("is-connected", phase === "connected");
    els.psCall.classList.remove("minimized");
    els.psCallState.textContent = phase === "ringing" ? "جاري الرنّ… محاكاة داخل الموقع" : "المكالمة متصلة · محاكاة تفاعلية";
    els.psCallTimer.textContent = "00:00";
    els.psCallTranscript.innerHTML = "";
    els.psCallPad.hidden = true;
    els.psMute.classList.remove("on");
    els.psSpeaker.classList.remove("on");
  }

  function startCall(target, direction, skipRing) {
    if (!target) return;
    if (state.call) endCall(true);
    closeSheet();
    hideIncoming();
    var phase = skipRing ? "connected" : "ringing";
    state.call = {
      target: target, direction: direction || "out", phase: phase,
      startedAt: skipRing ? Date.now() : null, tick: null, connectTimer: null, seconds: 0
    };
    els.psCall.hidden = false;
    setCallUI(target, phase);
    if (skipRing) {
      connected();
    } else {
      startRing();
      buzz([200, 120, 200]);
      state.call.connectTimer = setTimeout(connected, 2600);
    }
  }

  function connected() {
    var call = state.call;
    if (!call || call.phase === "connected") return;
    call.phase = "connected";
    call.startedAt = Date.now();
    stopRing();
    els.psCall.classList.remove("is-ringing");
    els.psCall.classList.add("is-connected");
    els.psCallState.textContent = "المكالمة متصلة · محاكاة تفاعلية";
    call.tick = setInterval(function () {
      if (!state.call) return;
      state.call.seconds = Math.floor((Date.now() - state.call.startedAt) / 1000);
      els.psCallTimer.textContent = durationText(state.call.seconds);
    }, 500);
    addTranscript(welcomeText, "in");
    if (S.menu) buzz(30);
  }

  function ivr(key) {
    var call = state.call;
    if (!call || call.phase !== "connected") return;
    addTranscript("اضغطت: " + key, "out");
    tone(520, 80, 0.025);
    var reply = menuReplies[key] || menuReplies.other || "تم استلام اختيارك.";
    var link = null;
    if (key === "1") {
      link = { label: "افتح واتساب", href: waFor(call.target.phone, "السلام عليكم، عندي استفسار عن صيانة سوفت وير") };
    } else if (key === "2") {
      link = { label: "عرض الأدوات في الموقع", href: "#tools", external: false, action: function () { endCall(); close(); } };
    } else if (key === "3") {
      link = { label: "افتح واتساب", href: waFor(call.target.phone, "السلام عليكم، عايز أتكلّم مع TWINS GSM") };
    }
    setTimeout(function () { if (state.call === call) addTranscript(reply, "in", link); }, 550);
  }

  function endCall(silent) {
    stopRing();
    var call = state.call;
    if (!call) return;
    if (call.tick) clearInterval(call.tick);
    if (call.connectTimer) clearTimeout(call.connectTimer);
    var type = call.direction === "in" ? "in" : "out";
    recents.unshift({
      name: call.target.name, phone: call.target.phone, color: call.target.color,
      type: type, seconds: call.seconds || 0, ts: Date.now()
    });
    recents = recents.slice(0, 60);
    persistRecents();
    state.call = null;
    els.psCall.hidden = true;
    els.psCall.classList.remove("minimized", "is-ringing", "is-connected");
    els.psCallPad.hidden = true;
    if (!silent) { toast("انتهت المكالمة — اتسجلت في السجل ✓"); buzz(40); }
  }

  function minimizeCall() {
    if (!state.call) return;
    var min = els.psCall.classList.toggle("minimized");
    els.psCallMin.textContent = min ? "▲" : "─";
    els.psCallMin.setAttribute("aria-label", min ? "استعادة المكالمة" : "تصغير المكالمة");
  }

  /* ================= مكالمة واردة ================= */

  function showIncoming(target) {
    hideIncoming();
    state.incoming = target;
    els.psIncomingName.textContent = target.name;
    els.psIncomingNumber.textContent = target.phone || "—";
    els.psIncomingAvatar.textContent = initials(target.name);
    els.psIncomingAvatar.style.background = "linear-gradient(140deg," + (target.color || "#ff8a1f") + ",rgba(var(--ps-accent-rgb),.4))";
    els.psIncoming.hidden = false;
    startRing();
    buzz([200, 120, 200, 120, 200]);
  }
  function hideIncoming() {
    state.incoming = null;
    if (els.psIncoming) els.psIncoming.hidden = true;
    var callActive = !!state.call && state.call.phase === "ringing";
    if (!callActive) stopRing();
  }
  function declineIncoming() {
    var t = state.incoming;
    hideIncoming();
    stopRing();
    if (t) {
      recents.unshift({ name: t.name, phone: t.phone, color: t.color, type: "missed", seconds: 0, ts: Date.now() });
      recents = recents.slice(0, 60);
      persistRecents();
    }
    toast("تم رفض المكالمة التجريبية");
  }
  function acceptIncoming() {
    var t = state.incoming;
    if (t) startCall(t, "in", true);
  }

  /* ================= جهات الاتصال ================= */

  function renderContacts() {
    var q = String(els.psContactSearch.value || "").trim().toLowerCase();
    var list = contacts.filter(function (c) {
      if (state.filter === "fav" && !c.fav) return false;
      if (state.filter === "team" && !c.team) return false;
      if (state.filter === "custom" && !c.custom) return false;
      if (!q) return true;
      return (c.name + " " + (c.role || "") + " " + (c.phone || "")).toLowerCase().indexOf(q) > -1;
    });
    $$("button", els.psContactFilters).forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-filter") === state.filter); });
    if (!list.length) {
      els.psContactList.innerHTML = '<div class="ps-empty"><b>☎</b>مفيش جهات اتصال هنا.<br>جرّب فلتر تاني أو أضف جهة جديدة.</div>';
      return;
    }
    els.psContactList.innerHTML = list.map(function (c) {
      var wa = waFor(c.phone);
      return '<div class="ps-row" data-contact="' + esc(c.id) + '" role="button" tabindex="0">' +
        '<span class="ps-avatar" style="background:' + esc(c.color || "#ff8a1f") + '">' + esc(initials(c.name)) + '</span>' +
        '<span class="ps-row-main"><b>' + esc(c.name) + (c.fav ? " ⭐" : "") + '</b><small>' + esc(c.role || c.phone || "") + '</small></span>' +
        '<button type="button" class="ps-mini call" data-call="' + esc(c.id) + '" aria-label="اتصال تجريبي لـ ' + esc(c.name) + '">' +
          '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.4 16.6v2.7a1.8 1.8 0 0 1-2 1.8 17.5 17.5 0 0 1-7.6-2.7 17 17 0 0 1-5.2-5.2A17.5 17.5 0 0 1 2.9 5.6a1.8 1.8 0 0 1 1.8-2h2.7a1.8 1.8 0 0 1 1.8 1.5c.1.8.3 1.5.6 2.2a1.8 1.8 0 0 1-.4 1.9L8 10.3a14 14 0 0 0 5.7 5.7l1.1-1.1a1.8 1.8 0 0 1 1.9-.4c.7.3 1.4.5 2.2.6a1.8 1.8 0 0 1 1.5 1.5z"/></svg></button>' +
        (wa !== "#" ? '<a class="ps-mini wa" href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer" aria-label="واتساب ' + esc(c.name) + '">' +
          '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 3.5A11 11 0 0 0 3.1 17.6L2 22l4.5-1.2A11 11 0 1 0 20.5 3.5Z"/></svg></a>' : "") +
        '</div>';
    }).join("");
  }

  function contactById(id) {
    for (var i = 0; i < contacts.length; i++) if (contacts[i].id === id) return contacts[i];
    return null;
  }

  function openContactSheet(c) {
    var wa = waFor(c.phone);
    var actions = [
      '<button type="button" data-act="demo" class="primary">📞 مكالمة تجريبية</button>',
      '<button type="button" data-act="real">✆ اتصال حقيقي</button>',
      '<button type="button" data-act="sms">💬 رسالة SMS</button>',
      (wa !== "#" ? '<a href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer">🟢 واتساب</a>' : ""),
      '<button type="button" data-act="fav">' + (c.fav ? "☆ إزالة من المفضلة" : "⭐ إضافة للمفضلة") + '</button>',
      '<button type="button" data-act="chat">✉ محادثة تجريبية</button>'
    ];
    if (c.custom) {
      actions.push('<button type="button" data-act="edit">✏️ تعديل</button>');
      actions.push('<button type="button" data-act="delete" class="danger">🗑 حذف</button>');
    }
    openSheet(
      '<div class="ps-sheet-grip"></div>' +
      '<div class="ps-sheet-hero"><span class="ps-avatar" style="background:' + esc(c.color || "#ff8a1f") + '">' + esc(initials(c.name)) + '</span>' +
        '<b>' + esc(c.name) + '</b><small>' + esc(c.role || "") + '</small><small dir="ltr">' + esc(c.phone || "—") + '</small></div>' +
      '<div class="ps-sheet-actions">' + actions.join("") + '</div>'
    );
    $$('[data-act]', els.psSheetCard).forEach(function (b) {
      b.addEventListener("click", function () {
        var act = b.getAttribute("data-act");
        if (act === "demo") startCall(c, "out");
        else if (act === "real") confirmRealCall(c.phone, c.name);
        else if (act === "sms") confirmSms(c.phone);
        else if (act === "fav") { c.fav = !c.fav; persistContacts(); renderContacts(); closeSheet(); toast(c.fav ? "اتضافت للمفضلة ⭐" : "اتشالت من المفضلة"); }
        else if (act === "chat") { openConv(c.id); }
        else if (act === "edit") contactForm(c);
        else if (act === "delete") confirmDelete(c);
      });
    });
  }

  function contactForm(existing) {
    var c = existing || { name: "", role: "", phone: "", fav: false, color: "#4f8cff" };
    openSheet(
      '<div class="ps-sheet-grip"></div><h3>' + (existing ? "تعديل جهة اتصال" : "جهة اتصال جديدة") + '</h3>' +
      '<p>الجهة هتتحفظ على جهازك في المتصفح وتظهر هنا دايماً.</p>' +
      '<form id="psContactForm">' +
        '<label class="ps-field"><span>الاسم</span><input name="name" required maxlength="40" value="' + esc(c.name) + '" placeholder="مثال: Ahmed" /></label>' +
        '<label class="ps-field"><span>الوصف / القسم</span><input name="role" maxlength="60" value="' + esc(c.role || "") + '" placeholder="مثال: عميل / دعم فني" /></label>' +
        '<label class="ps-field"><span>الرقم</span><input name="phone" type="tel" required maxlength="25" dir="ltr" value="' + esc(c.phone || "") + '" placeholder="+20 1xxxxxxxxx" /></label>' +
        '<button type="submit" class="ps-sheet-submit">' + (existing ? "حفظ التعديلات" : "إضافة") + '</button>' +
      '</form>'
    );
    $("psContactForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.currentTarget.elements;
      var name = String(f.name.value || "").trim();
      var phone = String(f.phone.value || "").trim();
      if (!name || !phone) return;
      if (existing) {
        existing.name = name; existing.role = String(f.role.value || "").trim(); existing.phone = phone;
      } else {
        contacts.push({
          id: "custom-" + Date.now(), name: name, role: String(f.role.value || "").trim(), phone: phone,
          fav: false, team: false, custom: true, color: "#4f8cff"
        });
      }
      persistContacts(); renderContacts(); closeSheet();
      toast(existing ? "تم حفظ التعديلات ✓" : "تمت إضافة جهة الاتصال ✓");
    });
  }

  function confirmDelete(c) {
    openSheet(
      '<div class="ps-sheet-grip"></div><h3>حذف «' + esc(c.name) + '»؟</h3><p>هتتحذف من جهات اتصال الموقع على هذا الجهاز فقط.</p>' +
      '<div class="ps-sheet-actions"><button type="button" data-act="cancel">إلغاء</button><button type="button" data-act="yes" class="danger">تأكيد الحذف</button></div>'
    );
    els.psSheetCard.querySelector('[data-act="cancel"]').addEventListener("click", closeSheet);
    els.psSheetCard.querySelector('[data-act="yes"]').addEventListener("click", function () {
      contacts = contacts.filter(function (x) { return x.id !== c.id; });
      persistContacts(); renderContacts(); closeSheet(); toast("تم الحذف");
    });
  }

  /* ================= تحويل للتطبيقات الحقيقية ================= */

  function confirmRealCall(phone, name) {
    var num = digitsOf(phone);
    if (!num) { toast("مفيش رقم صالح"); return; }
    openSheet(
      '<div class="ps-sheet-grip"></div><h3>اتصال حقيقي بـ ' + esc(name || "الرقم") + '</h3>' +
      '<p>الزر ده هيفتح <b>تطبيق الهاتف</b> على جهازك بالرقم: <b dir="ltr">' + esc(num) + '</b>.<br>تقدر تلغي من التطبيق قبل الاتصال — الموقع نفسه ما بيعملش مكالمة صامتة.</p>' +
      '<div class="ps-sheet-actions"><a class="primary" href="tel:' + esc(num) + '">📱 فتح تطبيق الهاتف</a><button type="button" data-act="cancel">رجوع للمحاكاة</button></div>'
    );
    els.psSheetCard.querySelector('[data-act="cancel"]').addEventListener("click", closeSheet);
  }
  function confirmSms(phone) {
    var num = digitsOf(phone).replace(/\+/g, "");
    if (!num) { toast("مفيش رقم صالح"); return; }
    var body = encodeURIComponent("السلام عليكم TWINS GSM، محتاج مساعدة بخصوص جهازي.");
    var href = "sms:" + num + "?body=" + body;
    openSheet(
      '<div class="ps-sheet-grip"></div><h3>رسالة SMS</h3><p>هتفتح تطبيق الرسائل على جهازك برسالة جاهزة.</p>' +
      '<div class="ps-sheet-actions"><a class="primary" href="' + esc(href) + '">✉ فتح الرسائل</a><button type="button" data-act="cancel">إلغاء</button></div>'
    );
    els.psSheetCard.querySelector('[data-act="cancel"]').addEventListener("click", closeSheet);
  }

  /* ================= السجل ================= */

  function renderRecents() {
    if (!recents.length) {
      els.psRecentList.innerHTML = '<div class="ps-empty"><b>◷</b>لسه مفيش مكالمات.<br>جرّب تعمل مكالمة من لوحة الأرقام.</div>';
      return;
    }
    els.psRecentList.innerHTML = recents.map(function (r, i) {
      var cls = r.type === "missed" ? "missed" : (r.type === "in" ? "in" : "");
      var icon = r.type === "missed" ? "↙" : (r.type === "in" ? "↙" : "↗");
      var time = new Date(r.ts || Date.now()).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
      return '<div class="ps-row" data-recent="' + i + '" role="button" tabindex="0">' +
        '<span class="ps-avatar" style="background:' + esc(r.color || "#8e95a4") + '">' + esc(initials(r.name)) + '</span>' +
        '<span class="ps-row-main"><b>' + esc(r.name) + '</b><small>' + esc(r.phone || "") + '</small></span>' +
        '<span class="ps-rec-icon ' + cls + '">' + icon + '</span>' +
        '<span class="ps-row-meta">' + esc(time) + (r.seconds ? "<br>" + durationText(r.seconds) : "") + '</span></div>';
    }).join("");
  }

  /* ================= الرسائل ================= */

  function convList() {
    var map = {};
    contacts.forEach(function (c) { map[c.id] = { id: c.id, name: c.name, phone: c.phone, color: c.color, role: c.role }; });
    return Object.keys(map).map(function (k) { return map[k]; });
  }
  function convById(id) {
    var list = convList();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function getMsgs(id) { return Array.isArray(messages[id]) ? messages[id] : []; }
  function renderConversations() {
    els.psChat.hidden = true;
    state.conv = null;
    var list = convList();
    els.psConversations.innerHTML = list.map(function (c) {
      var ms = getMsgs(c.id);
      var last = ms.length ? ms[ms.length - 1] : { text: "ابدأ محادثة تجريبية مع " + c.name, in: true, ts: Date.now() };
      return '<div class="ps-row" data-conv="' + esc(c.id) + '" role="button" tabindex="0">' +
        '<span class="ps-avatar" style="background:' + esc(c.color || "#ff8a1f") + '">' + esc(initials(c.name)) + '</span>' +
        '<span class="ps-row-main"><b>' + esc(c.name) + '</b><small>' + esc(String(last.text).replace(/\n/g, " ").slice(0, 60)) + '</small></span>' +
        '<span class="ps-row-meta">' + esc(nowTime()) + '</span></div>';
    }).join("");
  }
  function openConv(id) {
    var c = convById(id) || contacts[0];
    if (!c) return;
    closeSheet();
    showScreen("messages");
    state.conv = c.id;
    els.psConversations.hidden = true;
    els.psChat.hidden = false;
    els.psChatTitle.textContent = c.name;
    els.psChatAvatar.textContent = initials(c.name);
    els.psChatAvatar.style.background = c.color || "#ff8a1f";
    renderChat();
    setTimeout(function () { els.psChatInput.focus(); }, 50);
  }
  function renderChat() {
    var ms = getMsgs(state.conv);
    if (!ms.length) {
      ms = [{ in: true, text: "أهلاً بك في محادثة " + (convById(state.conv) || {}).name + " 👋\nاكتب رسالتك وهنرد عليك تلقائياً.", ts: Date.now() }];
      messages[state.conv] = ms;
      persistMessages();
    }
    els.psChatMessages.innerHTML = ms.map(function (m) {
      return '<div class="ps-msg ' + (m.in ? "in" : "out") + '">' + esc(m.text) + '<small>' + esc(new Date(m.ts || Date.now()).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })) + '</small></div>';
    }).join("");
    els.psChatMessages.scrollTop = els.psChatMessages.scrollHeight;
  }
  function sendChat(text) {
    if (!state.conv || !text.trim()) return;
    var ms = getMsgs(state.conv);
    ms.push({ in: false, text: text.trim(), ts: Date.now() });
    messages[state.conv] = ms;
    persistMessages();
    renderChat();
    els.psChatInput.value = "";
    if (!S.replies) return;
    var typing = document.createElement("div");
    typing.className = "ps-typing";
    typing.innerHTML = "بتكتب <i>.</i><i>.</i><i>.</i>";
    els.psChatMessages.appendChild(typing);
    els.psChatMessages.scrollTop = els.psChatMessages.scrollHeight;
    setTimeout(function () {
      if (typing.parentNode) typing.parentNode.removeChild(typing);
      var reply = getMsgs(state.conv);
      reply.push({ in: true, text: chatReply(text), ts: Date.now() });
      messages[state.conv] = reply;
      persistMessages();
      if (!els.psChat.hidden) renderChat();
      else renderConversations();
    }, 1100);
  }

  /* ================= الإعدادات ================= */

  function syncSettingsUI() {
    els.psSetSound.checked = !!S.sound;
    els.psSetVibrate.checked = !!S.vibrate;
    els.psSetMenu.checked = !!S.menu;
    els.psSetReplies.checked = !!S.replies;
    els.psSetLarge.checked = !!S.large;
    els.psDevice.classList.toggle("large-text", !!S.large);
    els.psDevice.style.setProperty("--ps-accent", S.accent || "#ff8a1f");
    var rgb = hexRgb(S.accent || "#ff8a1f");
    els.psDevice.style.setProperty("--ps-accent-rgb", rgb);
    $$("button", els.psAccents).forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-accent") === S.accent); });
  }
  function hexRgb(hex) {
    var n = parseInt(String(hex).replace("#", ""), 16);
    if (isNaN(n)) return "255,138,31";
    return ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255);
  }

  /* ================= النافذة المنبثقة ================= */

  function openSheet(html) {
    els.psSheetCard.innerHTML = html;
    els.psSheet.hidden = false;
  }
  function closeSheet() { if (els.psSheet) els.psSheet.hidden = true; }

  /* ================= الأحداث ================= */

  function bind() {
    // فتح / إغلاق
    document.addEventListener("click", function (e) {
      var opener = e.target.closest("[data-open-phone]");
      if (opener) { e.preventDefault(); open(opener.getAttribute("data-open-phone") || "dialer"); return; }
      if (e.target.closest("[data-close-phone]")) close();
      if (e.target.closest("[data-close-sheet]")) closeSheet();
    });

    els.psTabs.addEventListener("click", function (e) {
      var b = e.target.closest("[data-screen]");
      if (b) showScreen(b.getAttribute("data-screen"));
    });

    els.psKeypad.addEventListener("click", function (e) {
      var k = e.target.closest("[data-key]");
      if (k) pressDigit(k.getAttribute("data-key"), false);
    });
    els.psCallPadKeys.addEventListener("click", function (e) {
      var k = e.target.closest("[data-key]");
      if (k) pressDigit(k.getAttribute("data-key"), true);
    });
    els.psBackspace.addEventListener("click", function () { state.digits = state.digits.slice(0, -1); tone(260, 60, 0.02); updateDial(); });
    els.psCallBtn.addEventListener("click", function () { startCall(activeTarget(), "out"); });
    els.psDialContacts.addEventListener("click", function () { showScreen("contacts"); });
    els.psDemoIncoming.addEventListener("click", function () {
      var t = contacts[Math.floor(Math.random() * contacts.length)] || activeTarget();
      showIncoming(t);
    });
    els.psRealCall.addEventListener("click", function () { confirmRealCall(activeTarget().phone, activeTarget().name); });

    // جهات الاتصال
    els.psContactSearch.addEventListener("input", renderContacts);
    els.psContactFilters.addEventListener("click", function (e) {
      var b = e.target.closest("[data-filter]");
      if (!b) return;
      state.filter = b.getAttribute("data-filter");
      renderContacts();
    });
    els.psAddContact.addEventListener("click", function () { contactForm(null); });
    els.psContactList.addEventListener("click", function (e) {
      var mini = e.target.closest("[data-call]");
      if (mini) {
        e.stopPropagation();
        var c = contactById(mini.getAttribute("data-call"));
        if (c) startCall(c, "out");
        return;
      }
      if (e.target.closest("a")) return;
      var row = e.target.closest("[data-contact]");
      if (row) openContactSheet(contactById(row.getAttribute("data-contact")));
    });
    els.psContactList.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var row = e.target.closest("[data-contact]");
      if (row) { e.preventDefault(); openContactSheet(contactById(row.getAttribute("data-contact"))); }
    });

    // السجل
    els.psClearRecents.addEventListener("click", function () {
      if (!recents.length) return;
      openSheet('<div class="ps-sheet-grip"></div><h3>مسح سجل المكالمات؟</h3><p>هيتمسح السجل من هذا الجهاز فقط.</p>' +
        '<div class="ps-sheet-actions"><button type="button" data-act="cancel">إلغاء</button><button type="button" data-act="yes" class="danger">مسح الكل</button></div>');
      els.psSheetCard.querySelector('[data-act="cancel"]').addEventListener("click", closeSheet);
      els.psSheetCard.querySelector('[data-act="yes"]').addEventListener("click", function () {
        recents = []; persistRecents(); renderRecents(); closeSheet(); toast("تم مسح السجل");
      });
    });
    els.psRecentList.addEventListener("click", function (e) {
      var row = e.target.closest("[data-recent]");
      if (!row) return;
      var r = recents[parseInt(row.getAttribute("data-recent"), 10)];
      if (r) startCall({ name: r.name, phone: r.phone, color: r.color, custom: true }, "out");
    });
    els.psRecentList.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var row = e.target.closest("[data-recent]");
      if (row) startCall(recents[parseInt(row.getAttribute("data-recent"), 10)], "out");
    });

    // الرسائل
    els.psConversations.addEventListener("click", function (e) {
      var row = e.target.closest("[data-conv]");
      if (row) openConv(row.getAttribute("data-conv"));
    });
    els.psChatBack.addEventListener("click", function () { state.conv = null; els.psChat.hidden = true; els.psConversations.hidden = false; renderConversations(); });
    els.psChatForm.addEventListener("submit", function (e) { e.preventDefault(); sendChat(els.psChatInput.value); });

    // الإعدادات
    var toggleMap = { psSetSound: "sound", psSetVibrate: "vibrate", psSetMenu: "menu", psSetReplies: "replies", psSetLarge: "large" };
    Object.keys(toggleMap).forEach(function (id) {
      els[id].addEventListener("change", function () {
        S[toggleMap[id]] = !!els[id].checked;
        persistSettings(); syncSettingsUI();
        if (!S.sound) stopRing();
      });
    });
    els.psAccents.addEventListener("click", function (e) {
      var b = e.target.closest("[data-accent]");
      if (!b) return;
      S.accent = b.getAttribute("data-accent");
      persistSettings(); syncSettingsUI(); tone(620, 90, 0.02);
    });
    els.psReset.addEventListener("click", function () {
      openSheet('<div class="ps-sheet-grip"></div><h3>إعادة ضبط الهاتف؟</h3><p>هتحذف جهات الاتصال والمكالمات والرسائل اللي حفظتها هنا وترجع للإعدادات الأصلية.</p>' +
        '<div class="ps-sheet-actions"><button type="button" data-act="cancel">إلغاء</button><button type="button" data-act="yes" class="danger">إعادة ضبط</button></div>');
      els.psSheetCard.querySelector('[data-act="cancel"]').addEventListener("click", closeSheet);
      els.psSheetCard.querySelector('[data-act="yes"]').addEventListener("click", function () {
        [KEY.contacts, KEY.recents, KEY.messages, KEY.settings].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
        contacts = baseContacts.map(function (c) { return Object.assign({}, c); });
        recents = []; messages = {}; S = Object.assign({}, defaultSettings);
        persistContacts(); persistRecents(); persistMessages(); persistSettings();
        closeSheet(); syncSettingsUI(); renderContacts(); renderRecents(); updateDial(); toast("تمت إعادة الضبط ✓");
      });
    });

    // المكالمة
    els.psCallMin.addEventListener("click", function (e) { e.stopPropagation(); minimizeCall(); });
    els.psCall.addEventListener("click", function (e) { if (state.call && els.psCall.classList.contains("minimized") && !e.target.closest("#psEndCall")) minimizeCall(); });
    els.psEndCall.addEventListener("click", function () { endCall(); });
    els.psMute.addEventListener("click", function () { els.psMute.classList.toggle("on"); toast(els.psMute.classList.contains("on") ? "تم كتم المايك" : "تم فتح المايك"); });
    els.psSpeaker.addEventListener("click", function () { els.psSpeaker.classList.toggle("on"); toast(els.psSpeaker.classList.contains("on") ? "مكبر الصوت شغال" : "مكبر الصوت مقفول"); });
    els.psKeypadToggle.addEventListener("click", function () {
      els.psCallPad.hidden = !els.psCallPad.hidden;
      els.psKeypadToggle.classList.toggle("on", !els.psCallPad.hidden);
    });
    els.psAccept.addEventListener("click", acceptIncoming);
    els.psDecline.addEventListener("click", declineIncoming);

    // لوحة المفاتيح والخروج
    document.addEventListener("keydown", function (e) {
      if (!state.open) return;
      if (e.key === "Escape") {
        if (!els.psSheet.hidden) closeSheet();
        else if (state.incoming) declineIncoming();
        else if (!els.psCall.hidden) endCall();
        else close();
        return;
      }
      if (!els.psSheet.hidden || !els.psCall.hidden || !els.psIncoming.hidden) return;
      if (/^[0-9*#]$/.test(e.key) && state.screen === "dialer" && document.activeElement.tagName !== "INPUT") pressDigit(e.key, false);
      if (e.key === "Tab") {
        var focusables = $$('button:not([hidden]), a[href], input:not([type="hidden"])', els.psDevice).filter(function (el) {
          return el.offsetParent !== null && !el.disabled;
        });
        if (!focusables.length) return;
        var first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ================= البدء ================= */

  initEls();
  buildKeypads();
  bind();
  syncSettingsUI();
  updateDial();
  renderContacts();
  renderRecents();
  renderConversations();
  if (els.psYear) els.psYear.textContent = new Date().getFullYear();

  window.TWINS_PHONE = {
    open: open,
    close: close,
    call: function (name, phone) {
      open("dialer");
      startCall({ name: name || "TWINS GSM", phone: phone || (D.contact || {}).phoneDisplay || "", color: "#ff8a1f" }, "out");
    }
  };
})();
