# استقرار امن نسخه Preview

نسخه `preview/` فقط محیط نمایشی است و تا زمان انتقال کامل احراز هویت و داده‌ها به سمت سرور نباید برای اطلاعات واقعی استفاده شود.

## فعال‌سازی دروازه امنیتی Cloudflare Pages

فایل `preview/_worker.js` یک دروازه Basic Authentication سمت Cloudflare دارد که فقط با Secretهای محیطی فعال می‌شود.

در Cloudflare Dashboard:

1. وارد **Workers & Pages** شوید.
2. پروژه `salamat-aval-caregiver-club` را انتخاب کنید.
3. مسیر **Settings > Variables and Secrets** را باز کنید.
4. متغیر زیر را اضافه کنید:
   - `PREVIEW_AUTH_ENABLED` با مقدار `true`
5. دو Secret رمزنگاری‌شده اضافه کنید:
   - `PREVIEW_AUTH_USERNAME`
   - `PREVIEW_AUTH_PASSWORD`
6. برای رمز عبور حداقل ۲۰ کاراکتر تصادفی استفاده کنید و آن را در GitHub، کد یا پیام عمومی قرار ندهید.
7. پروژه را Redeploy کنید.

اگر `PREVIEW_AUTH_ENABLED=true` باشد ولی نام کاربری یا رمز تنظیم نشده باشد، Worker به شکل fail-closed پاسخ 503 می‌دهد و سایت عمومی نمی‌شود.

## لایه توصیه‌شده قوی‌تر

در Cloudflare Zero Trust یک **Access self-hosted application** برای کل دامنه ایجاد کنید و فقط ایمیل‌های مورد تأیید سازمان را Allow کنید. در این حالت Basic Authentication صرفاً لایه دوم موقت خواهد بود.

## تنظیمات اجباری مخزن GitHub

- Repository را Private کنید.
- Secret scanning و Push protection را فعال کنید.
- Branch protection برای `main` فعال شود:
  - Require pull request
  - Require status checks
  - Require CodeQL and CI
  - Block force pushes
  - Require conversation resolution
- تمام رمزهایی که قبلاً در Git history قرار گرفته‌اند فوراً Rotate شوند.

## محدودیت مهم

این دروازه فقط دسترسی به Preview را محدود می‌کند. مجوز نقش‌ها، نشست کاربران و حفاظت از داده‌های حساس باید در API و دیتابیس سمت سرور پیاده‌سازی شوند. `localStorage` و کد JavaScript مرورگر محل امنی برای رمز، نقش، پرونده پزشکی یا اطلاعات هویتی نیستند.
