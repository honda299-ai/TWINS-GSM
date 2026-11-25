# TWINS GSM — موقع professionel

موقع عربي (RTL) بأسلوب أسود وبرتقالي لمجال GSM والسوفت وير، يعرض الخدمات والأعمال والأدوات القابلة للتحميل.

## الملفات

- `index.html` — هيكل الموقع.
- `styles.css` — التصميم والألوان والاستجابة للجوال.
- `data.js` — **كل النصوص والبيانات والروابط** (عدّل من هنا).
- `app.js` — عرض المحتوى وتفاعلات البحث/التصفية/القائمة/الأسئلة.
- `tools/` — ملفات الأدوات اللي الناس تنزلها.
- `assets/favicon.svg` — أيقونة الموقع.
- `firebase-config.js` — إعدادات Firebase (عدّلها قبل النشر).
- `firebase.json`, `.firebaserc`, `firestore.rules` — ملفات النشر والصلاحيات (بدون Storage).
- `FIREBASE.md` — شرح ربط Hosting + Firestore + Analytics خطوة بخطوة.
- `admin.html` + `admin.js` + `admin.css` — لوحة تحكم لإدارة المحتوى من المتصفح.
- `account.html` + `account.js` + `account.css` — منطقة الأعضاء (تسجيل/دخول، أسعار، تحميلات، طلبات).

## تشغيل الموقع محلياً

افتح `index.html` في المتصفح، أو شغّل سيرفر بسيط:

```powershell
python -m http.server 8000
```

ثم افتح `http://localhost:8000`.

> ملاحظة: لو فتحت الملف مباشرة `file://`، معظم الحالات هتشغل، لكن بعض المتصفحات ممكن تمنع تحميل الخط من Google Fonts. السيرفر المحلي أفضل.

## أهم حاجات لازم تعدّلها قبل النشر

1. افتح `data.js`:
   - `contact.whatsapp` — ضع رابط واتساب الحقيقي (`https://wa.me/رقمك`).
   - `contact.phoneDisplay`, `contact.email`, والروابط الاجتماعية.
   - `stats` و`services` و`works` و`tools` و`testimonials` و`faqs` ببياناتك الحقيقية.
2. استبدل ملفات `tools/*.zip` التجريبية بأدواتك (نفس الأسماء أو عدّل `file` في `data.js`).
3. غيّر `<title>` و`meta description` في `index.html` لو حابب.

## رفع الموقع

ارفع كل الملفات والمجلدات (بما فيها `tools/`) على أي استضافة ثابتة مثل Netlify / Vercel / GitHub Pages أو استضافة مشتركة عادية. الموقع لا يحتاج قاعدة بيانات أو سيرفر PHP.

## لون الموقع

الألوان معرّفة في أول `styles.css` داخل `:root`:

- `--bg: #08090b` (أسود)
- `--orange: #ff7a1a` (برتقالي)

غيّر القيمتين لو حابب درجة تانية.
