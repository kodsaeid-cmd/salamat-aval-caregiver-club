# استقرار باشگاه مراقبین روی Cloudflare

## انتشار فوری پیش‌نمایش تعاملی

در Cloudflare Dashboard:

1. وارد **Workers & Pages** شوید.
2. روی **Create application** و سپس **Pages** بزنید.
3. گزینه **Connect to Git** را انتخاب کنید.
4. مخزن `kodsaeid-cmd/salamat-aval-caregiver-club` را متصل کنید.
5. تنظیمات Build را این‌گونه قرار دهید:
   - Production branch: `main`
   - Framework preset: `None`
   - Build command: خالی
   - Build output directory: `preview`
6. روی **Save and Deploy** بزنید.

## اتصال دامنه

پس از اولین Deploy:

1. در پروژه Pages به **Custom domains** بروید.
2. دامنه `salamatavalcaregivers.site` را اضافه کنید.
3. دامنه اصلی را در بخش Websites حساب Cloudflare نیز اضافه کنید.
4. Name Serverهای اعلام‌شده توسط Cloudflare را در پنل ثبت‌کننده دامنه جایگزین کنید.
5. بعد از فعال‌شدن Zone، SSL/TLS را روی `Full` و گزینه Always Use HTTPS را فعال کنید.

## معماری فعلی

پوشه `preview` نسخه نمایشی استاتیک و تعاملی باشگاه را منتشر می‌کند. اپ Next.js، API، Prisma و دیتابیس در حال حاضر برای محیط توسعه هستند و برای انتشار عملیاتی باید به Cloudflare Workers، D1 و R2 منتقل شوند.
