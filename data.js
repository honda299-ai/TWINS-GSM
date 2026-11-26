/* ============================================================
   TWINS GSM — عدّل من هنا فقط
   غيّر الأرقام والروابط والنصوص حسب بياناتك الحقيقية.
   ============================================================ */
window.TWINS_DATA = {
  contact: {
    phoneDisplay: "+20 121 288 1889",           // رقم الواتساب
    whatsapp: "https://wa.me/201212881889?text=" + encodeURIComponent("السلام عليكم، عندي جهاز محتاج صيانة سوفت وير وعرايز أتعاون مع TWINS GSM"),
    email: "hello@twinsgsm.example",             // ✏️ إيميلك
    facebook: "#",                               // ✏️ رابط فيسبوك
    tiktok: "#",                                 // ✏️ رابط تيك توك
    instagram: "#"                               // ✏️ رابط إنستغرام
  },

  stats: [
    { value: "+502", label: "جهاز تم إصلاحه بنجاح" },
    { value: "100%", label: "ضمان على السوفت وير" },
    { value: "99%", label: "حفظ بيانات الجهاز" },
    { value: "2024", label: "سنة خبرة عملية" }
  ],

  services: [
    { icon: "bolt", title: "إحياء الأجهزة العالقة", desc: "حل مشكلة الـ Bootloop والريستارت التلقائي وتفليش الروم الرسمي بأمان تام.", tag: "Bootloop" },
    { icon: "lock", title: "فك الحمايات والأقفال", desc: "تخطي حسابات Google وMi Account وHuawei ID ورموز الشاشة مع الحفظ حيثما أمكن.", tag: "FRP & Locks" },
    { icon: "globe", title: "التعريب وتغيير التوجيه", desc: "تحويل الأجهزة المستوردة لدعم الشبكات العربية و VoLTE و 5G بكفاءة.", tag: "CSC" },
    { icon: "signal", title: "إصلاح مشاكل الشبكة والـ IMEI", desc: "تشخيص واصلاح السيريال وفقدان الشبكة وخطوط IMEI للعودة للعمل.", tag: "GSM / IMEI" },
    { icon: "laptop", title: "صيانة عن بُعد", desc: "نصلح هاتفك وأنت في بيتك بربطه بالكمبيوتر عبر كابل USB وبرامج اتصال آمنة.", tag: "Remote" },
    { icon: "shield", title: "استعادة البيانات", desc: "إنقاذ صورك وملفاتك قبل التفليش أو أثناء إصلاح النظام بأقل تدخل ممكن.", tag: "Data" }
  ],

  steps: [
    { title: "ابعثلنا المشكلة", desc: "صورة أو وصف بسيط لنوع الجهاز والعطل اللي بيظهر." },
    { title: "نشخّص ونحدّد الحل", desc: "نقول لك الحل المتوقع والوقت والتكلفة قبل أي خطوة." },
    { title: "الجهاز يرجع يشتغل", desc: "تنفيذ دقيق واختبار كامل قبل التسليم مع ضمان." }
  ],

  works: [
    { category: "iphone", brand: "iPhone", model: "iPhone XS Max", desc: "passcode + استعادة الجهاز للعمل بدون فقدان البيانات." },
    { category: "samsung", brand: "Samsung", model: "Galaxy A56", desc: "FRP Android 17 — تم التخطي وتفعيل الشبكة." },
    { category: "xiaomi", brand: "Xiaomi", model: "Redmi 12 5G", desc: "إصلاح مشكلة السيريال وإرجاع الجهاز يعمل بنجاح." },
    { category: "iphone", brand: "iPhone", model: "iPhone 11", desc: "Bypass iCloud مع الحفاظ على تشغيل الشبكة." },
    { category: "tablet", brand: "iPad", model: "iPad Air 3", desc: "إزالة iCloud وتفعيل الجهاز من جديد." },
    { category: "samsung", brand: "Samsung", model: "Galaxy Tab A11", desc: "خروج من المنظومة وإعادة ضبط التوجيه." },
    { category: "other", brand: "Realme", model: "Realme Note 50", desc: "إصلاح مشاكل السيريال وIMEI." },
    { category: "other", brand: "Pico", model: "Pico 4 Ultra", desc: "مبرمجة التخطي — جاهزة للشحن لكل المحافظات." },
    { category: "iphone", brand: "iPhone", model: "iPhone 8", desc: "فتح جهاز واستعادة النظام بعد تعليق." }
  ],

  workCategories: [
    { id: "all", label: "كل الأعمال" },
    { id: "iphone", label: "آيفون" },
    { id: "samsung", label: "سامسونج" },
    { id: "xiaomi", label: "شاومي" },
    { id: "tablet", label: "تابلت" },
    { id: "other", label: "أجهزة أخرى" }
  ],

  // ملاحظة: ملفات tools/ الحالية تجريبية — استبدلها بأدواتك الحقيقية بنفس الأسماء.
  tools: [
    { name: "TWINS FRP Helper", category: "frp", desc: "أداة مساعدة لتخطي حسابات Google على أجهزة مختارة.", version: "v2.4", size: "18 MB", tag: "الأكثر تحميلاً", hot: true, file: "tools/twins-frp-helper.zip" },
    { name: "TWINS IMEI Fix Kit", category: "network", desc: "حزمة تشخيص وإصلاح مشاكل السيريال والشبكة.", version: "v1.8", size: "12 MB", tag: "محدث", hot: true, file: "tools/twins-imei-fix-kit.zip" },
    { name: "TWINS Flash Guide", category: "flash", desc: "دليل تفليش الرومات الرسمية الخطوة بخطوة مع ملاحظات الأمان.", version: "v3.1", size: "2 MB", tag: "دليل", hot: false, file: "tools/twins-flash-guide.zip" },
    { name: "TWINS CSC Changer", category: "network", desc: "أداة لتغيير التوجيه وتفعيل ترددات الشبكات العربية.", version: "v1.2", size: "9 MB", tag: "جديد", hot: false, file: "tools/twins-csc-changer.zip" },
    { name: "TWINS Boot Rescue", category: "flash", desc: "سكربت إنقاذ للأجهزة العالقة على الشعار والريستارت التلقائي.", version: "v1.0", size: "6 MB", tag: "تجريبي", hot: false, file: "tools/twins-boot-rescue.zip" },
    { name: "TWINS Device Checker", category: "frp", desc: "فحص سريع لحالة الجهاز والحمايات قبل البدء.", version: "v2.0", size: "4 MB", tag: "خفيف", hot: false, file: "tools/twins-device-checker.zip" }
  ],

  toolCategories: [
    { id: "all", label: "كل الأدوات" },
    { id: "frp", label: "FRP / أقفال" },
    { id: "network", label: "شبكات / IMEI" },
    { id: "flash", label: "تفليش / إقلاع" }
  ],

  testimonials: [
    { name: "Eesaf", text: "خدمة ممتازة وسريعة ومن الناس المحترمة.", role: "عميل" },
    { name: "Hamza Ali", text: "أخويا بالتوفيق، شغل ممتاز ✅", role: "عميل" },
    { name: "طه الخطيب", text: "عاش يا أخويا، حقيقي بتعب وربنا هيكرمك إن شاء الله 🤍🔥", role: "عميل" },
    { name: "أبو معاذ", text: "بالتوفيق إن شاء الله، أحلا تيم شغال في السوفت وير.", role: "عميل" },
    { name: "Mohamed Mossa", text: "الله ينور وبالتوفيق ❤", role: "عميل" },
    { name: "Amr Saleh", text: "Trusted 10000% — تعاملهم محترم جداً.", role: "عميل" }
  ],

  faqs: [
    { q: "هل إصلاح السوفت وير بيحذف بياناتي؟", a: "في أغلب الحالات بنحافظ على البيانات قدر الإمكان، ولو التفليش ضروري بنقولك قبل أي خطوة وننقل ملفاتك أولاً." },
    { q: "ممكن أصلح جهازي من البيت؟", a: "أيوه، الخدمة عن بُعد بتتم بربط الهاتف بالكمبيوتر عبر كابل USB وبرنامج اتصال آمن، وهنكون معاك طول الوقت." },
    { q: "الضمان بيشمل إيه؟", a: "ضمان على السوفت وير اللي عملناه، ولو رجع نفس العطل خلال مدة الضمان بنراجعه مجاناً." },
    { q: "إزاي أنزل الأدوات من الموقع؟", a: "ادخل قسم الأدوات، دوّر على الأداة اللي محتاجها واضغط زر التحميل. لو في أي استفسار كلّمنا على واتساب." }
  ]
};
