# TWINS GSM — Firebase (بدون Storage)

الموقع شغال على Firebase **Firestore + Hosting + Analytics** فقط. الأدوات بتتنزّل من مجلد `tools/` اللي اترفع مع الموقع على Hosting — **بدون أي دفع**.

> ✅ `firebase-config.js` و`.firebaserc` معبّأين بمشروع **twins-gsm**.

## 1) المطلوب تفعيله في Firebase Console

1. **Firestore Database** → Create database (وضع production).
2. **Authentication** → Sign-in method → فعّل **Email/Password**.
3. **Analytics** → Enable (اختياري بس شغال).

> **لا تفعّل Storage** — مش محتاجه خالص.

## 2) نشر القواعد

افتح https://console.firebase.google.com/project/twins-gsm/firestore/rules
والصق محتوى ملف `firestore.rules` عندك، ثم **Publish**.

أو:

```bash
npm install -g firebase-tools
firebase login
firebase use twins-gsm
firebase deploy --only firestore:rules
```

القواعد بتعمل الآتي:

- محتوى الموقع: قراءة للجميع، تعديل للأدمن/الشركاء.
- `users` / `downloads` / `requests`: كل عضو يشوف بياناته فقط، والأدمن يشوف الكل ويغيّر حالة الطلبات.
- `admins`: الأدمن الأساسي فقط يضيف/يمسح شريك.

## 3) ترتيب Firestore

| Collection | الحقول |
|---|---|
| `stats` | `value`, `label`, `order` |
| `services` | `icon`, `title`, `desc`, `tag`, `price`, `priceNote`, `order` |
| `steps` | `title`, `desc`, `order` |
| `works` | `brand`, `model`, `desc`, `category`, `order` |
| `workCategories` | `id`, `label`, `order` |
| `tools` | `name`, `desc`, `category`, `version`, `size`, `tag`, `hot`, `file`, `order` |
| `toolCategories` | `id`, `label`, `order` |
| `testimonials` | `name`, `text`, `role`, `order` |
| `faqs` | `q`, `a`, `order` |
| `site` | مستند `contact`: `phoneDisplay`, `whatsapp`, `email`, `facebook`, `tiktok`, `instagram` |
| `admins` | مستند باسم إيميل الشريك: `email`, `name`, `active`, `addedAt` |
| `media` | مكتبة الصور: `name`, `data`, `w`, `h`, `bytes`, `createdAt` |
| `site` | مستندين: `contact` (التواصل) و`settings` (كل نصوص وألوان وصور الموقع) |

مثال أداة:

```json
{
  "name": "TWINS FRP Helper",
  "desc": "أداة مساعدة لتخطي حسابات Google.",
  "category": "frp",
  "version": "v2.4",
  "size": "18 MB",
  "tag": "الأكثر تحميلاً",
  "hot": true,
  "file": "tools/twins-frp-helper.zip",
  "order": 1
}
```

## 4) الأدوات (بدون Storage)

1. ضع ملف الأداة داخل مجلد `tools/` في المشروع.
2. في مستند الأداة اكتب `file` = `tools/اسم-الملف.zip`.
3. انشر الموقع — الرابط هيبقى:
   `https://twins-gsm.web.app/tools/اسم-الملف.zip`

تقدر كمان تكتب رابط خارجي مباشر في `file` (مثلاً GitHub Releases).

> لو الملف مش موجود، زر التحميل هيظهر «قريباً» بدل ما يكسر.

## 5) لوحة التحكم — `admin.html` (الإصدار الجديد)

الدخول بحساب: `hondastore299@gmail.com` أو أي شريك مضاف.

| القسم | بيتحكم في إيه |
|---|---|
| **إعدادات الموقع** | الاسم والشعار واللون الأساسي، نصوص الواجهة والأقسام والقائمة والفوتر، شريط الإعلان، صورة الواجهة، SEO، إظهار/إخفاء أي قسم، زر واتساب العائم، بيانات التواصل |
| **الخدمات / الخطوات / الأعمال / الأدوات / الآراء / الأسئلة / الإحصائيات / التصنيفات** | إضافة، تعديل، حذف، **ترتيب بالأسهم ▲▼**، **إخفاء بدون حذف 👁**، نسخ ⧉، وبحث |
| **مكتبة الصور** | رفع صور (متعددة / سحب وإفلات)، معاينة، حذف |
| **الطلبات** | فلترة بالحالة، تغيير الحالة، رد بالإيميل، تصدير CSV |
| **الأعضاء / التحميلات** | بحث، وترتيب الأدوات الأكثر تحميلاً |
| **الشركاء** | إضافة / إيقاف / إزالة (للأدمن الأساسي فقط) |
| **نسخ احتياطي** | تنزيل نسخة JSON كاملة، استرجاعها، أو إرجاع المحتوى الافتراضي |

### أول مرة تفتح اللوحة
1. افتح **نظرة عامة** — هتلاقي «جاهزية الموقع». اضغط **استيراد** عشان محتوى `data.js` يتنقل لقاعدة البيانات ويبقى قابل للتعديل.
2. غيّر رقم الواتساب من **إعدادات الموقع ← التواصل** (الرقم الحالي تجريبي).

### الصور بدون Storage
الصورة بتتصغّر وتتضغط (WebP) داخل المتصفح وبتتخزن جوه مستند Firestore نفسه (حوالي 100–250 كيلوبايت للصورة). **مفيش Firebase Storage ومفيش دفع.** حد Firestore للمستند 1 ميجا، واللوحة بتضبط الحجم تلقائياً.

### ملاحظات مهمة
- لو حذفت **كل** عناصر قسم من Firestore، الموقع بيرجع يعرض الافتراضي من `data.js`. لو عايز تخفي قسم كامل استخدم **الأقسام والظهور**.
- ملفات `tools/` على Hosting روابطها عامة لأي حد يعرف المسار. بوابة «الأعضاء فقط» بتخفي الأدوات من الواجهة بس، مش حماية للملف نفسه.
- بعد أي تحديث لـ `firestore.rules` لازم تنشره (إضافة قاعدة `media` جديدة).

## 6) منطقة الأعضاء — `account.html`

- تسجيل جديد / دخول.
- الأسعار والأدوات للأعضاء فقط.
- تاريخ التحميلات وطلبات الصيانة.

## 7) نشر الموقع

```bash
firebase deploy --only hosting
```

الرابط: `https://twins-gsm.web.app`

## Analytics

الأحداث المسجّلة: `page_view`, `download`, `contact_whatsapp`, `search`.
