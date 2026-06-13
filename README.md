# Avocados POS — Supabase Edition

نظام نقاط بيع (POS) لـ Avocados Cafe، تمّت هجرة قاعدة بياناته من Firebase إلى Supabase بالكامل.
A point-of-sale app, migrated from Firebase to Supabase (Auth + Database + Realtime + Storage).

التصميم والواجهات والميزات لم تتغيّر إطلاقاً: تمّت الهجرة عبر طبقة توافق تحاكي واجهة Firebase فوق
Supabase، فلم يُعدَّل أي كود في App.tsx أو المكوّنات — فقط تبدّلت الطبقة الخلفية.

## كيف تمّت الهجرة (تقنياً)

- Firestore collections  ->  جداول Postgres `(id text, data jsonb, updated_at)`
- `onSnapshot` (فوري)     ->  Supabase Realtime (`postgres_changes`)
- Firebase Auth          ->  Supabase Auth
- `secondaryApp`         ->  عميل Supabase ثانوي (`storageKey` منفصل) لإنشاء المستخدمين دون إخراج المدير
- `signInWithPopup`      ->  `signInWithOAuth({provider:'google'})`
- Firestore Rules        ->  RLS Policies

الملفات الجديدة:
- `src/lib/supabaseClient.ts` — عميلا Supabase (أساسي + ثانوي).
- `src/lib/firestore-compat.ts` — يحاكي collection, doc, query, where, orderBy, limit, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc, getDocs.
- `src/lib/auth-compat.ts` — يحاكي onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, sendPasswordResetEmail.
- `src/firebase.ts` — يصدّر db, auth, secondaryAuth, googleProvider مربوطة بـ Supabase.
- `vite.config.ts` — alias يعيد توجيه `firebase/firestore` و`firebase/auth` إلى طبقات التوافق.
- ملفات Firebase القديمة محفوظة (غير مستخدمة) في `_legacy_firebase/`.

## خطوات التشغيل والنشر

### 1) إنشاء مشروع Supabase
1. https://supabase.com  ->  New project (اسم + كلمة مرور لقاعدة البيانات).
2. Project Settings -> API، وانسخ:
   - Project URL      -> VITE_SUPABASE_URL
   - anon public key  -> VITE_SUPABASE_ANON_KEY

### 2) إنشاء الجداول
افتح SQL Editor -> New query، الصق محتوى `supabase/schema.sql` كاملاً، ثم Run.
(يُنشئ 13 جدولاً + سياسات RLS + تفعيل Realtime + حاوية Storage باسم assets.)

### 3) إعداد المصادقة (Auth)
1. Authentication -> Providers -> Email: مفعّل. ولتسهيل إنشاء الكاشيرين من داخل التطبيق
   عطّل "Confirm email".
2. (اختياري) Google: فعّل المزوّد وأدخل Client ID/Secret، وأضف رابط موقعك في
   Authentication -> URL Configuration -> Redirect URLs.
3. أنشئ حساب المدير: Authentication -> Users -> Add user بالإيميل
   mohammadalmasri950@gmail.com وكلمة مرور. عند أول دخول يُنشأ ملفه تلقائياً بدور Admin.

### 4) التشغيل المحلي والتحقق
    npm install
    cp .env.example .env      # املأ VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY
    npm run build             # يجب أن يكتمل بدون أخطاء
    npm run dev               # جرّب الدخول / الحفظ / القراءة
تأكد: تسجيل الدخول، حفظ منتج/فاتورة، ظهور البيانات فوراً (Realtime)، لا أخطاء Console.

### 5) الرفع على GitHub
    git init
    git add .
    git commit -m "Avocados POS - migrated to Supabase"
    git branch -M main
    git remote add origin https://github.com/<USER>/<REPO>.git
    git push -u origin main

### 6) النشر على Vercel
1. https://vercel.com -> Add New -> Project -> Import مستودع GitHub.
2. Framework: Vite (يُكتشف تلقائياً). Build: `npm run build`، Output: `dist`.
3. Environment Variables أضِف: VITE_SUPABASE_URL، VITE_SUPABASE_ANON_KEY، GEMINI_API_KEY (اختياري).
4. Deploy. ثم أضِف رابط Vercel إلى Supabase -> Authentication -> URL Configuration -> Redirect URLs.

## ملاحظات
- الصور تُخزَّن base64 داخل البيانات كما في الأصل؛ حاوية assets جاهزة لرفع ملفات فعلية لاحقاً.
- المفتاح anon عام وآمن للواجهة؛ الحماية عبر RLS. لا تستخدم service_role في الواجهة إطلاقاً.
- `npm run build` لم يعد يعتمد على firebase (أُزيلت من الاعتماديات).
