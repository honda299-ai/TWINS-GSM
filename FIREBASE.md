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

## 5) لوحة التحكم — `admin.html`

- إدارة: الأدوات، الأعمال، الآراء، الخدمات (مع الأسعار)، الإحصائيات، الأسئلة، التصنيفات.
- طلبات العملاء: تغيير الحالة (جديد / قيد التنفيذ / تم التنفيذ).
- الأعضاء المسجلين + سجل التحميلات.
- **الشركاء / الأدمنز**: اكتب إيميل الشريك وضيفه.

الدخول بحساب: `hondastore299@gmail.com`

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
