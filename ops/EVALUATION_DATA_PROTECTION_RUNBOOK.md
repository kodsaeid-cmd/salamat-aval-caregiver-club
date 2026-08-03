# راهنمای حفاظت، بک‌آپ و بازیابی ارزیابی‌ها

نسخه معماری: `EVAL-PROTECT-1.0.0`

## تضمین‌های فعال

- حذف فیزیکی مراقب در دیتابیس ممنوع است؛ عملیات حذف به بایگانی نرم تبدیل می‌شود.
- حذف فیزیکی دوره ارزیابی و امتیاز ممنوع است.
- هر ثبت یا اصلاح امتیاز در `evaluation_score_revisions` به‌صورت Append-only ثبت می‌شود.
- هر ارزیابی نهایی یک Snapshot مستقل با SHA-256 در `evaluation_final_snapshots` دارد.
- ارزیابی نهایی‌شده و Snapshot آن قابل بازنویسی یا حذف نیستند.
- ارزیابی قدیمی فقط با ثبت دلیل بایگانی می‌شود.
- وظیفه زمان‌بندی‌شده Worker، Snapshotهای نهایی قدیمی را به‌تدریج Backfill و سلامت داده را بررسی می‌کند.

## مسیرهای مدیریتی

این مسیرها فقط برای مدیر اصلی محافظت‌شده قابل استفاده‌اند:

- `GET /api/admin/evaluation-protection/health`
- `POST /api/admin/evaluation-protection/backfill?limit=200`

بایگانی امن دوره ارزیابی با مجوز ویرایش ارزیابی:

- `POST /api/evaluations/{evaluationId}/archive`
- Body: `{ "reason": "دلیل بایگانی" }`

حذف پرونده مراقب از مسیر فعلی `DELETE /api/caregivers/{id}`، دیگر حذف فیزیکی نیست و پرونده، ارزیابی‌ها و کارنامه‌ها را نگه می‌دارد.

## Secrets لازم برای بک‌آپ روزانه

در GitHub Repository Settings > Secrets and variables > Actions، موارد زیر باید ثبت شوند:

- `CLOUDFLARE_API_TOKEN` با دسترسی خواندن D1 و اجرای Export
- `CLOUDFLARE_ACCOUNT_ID`

برای کپی مستقل خارج از Cloudflare نیز:

- `PARSPACK_S3_ENDPOINT`
- `PARSPACK_S3_BUCKET`
- `PARSPACK_S3_ACCESS_KEY`
- `PARSPACK_S3_SECRET_KEY`

هیچ Secret نباید در Repository، فایل Markdown، Issue یا لاگ متنی Commit شود.

## بک‌آپ روزانه

Workflow: `.github/workflows/d1-backup.yml`

هر اجرا موارد زیر را تولید می‌کند:

- Export کامل دیتابیس
- Export مستقل جدول‌های ارزیابی، Revision و Snapshot
- Bookmark فعلی D1 Time Travel
- SHA-256 تمام فایل‌ها
- Manifest شامل زمان، Commit و نسخه Schema
- Artifact با نگهداری ۹۰ روزه
- کپی اختیاری در فضای مستقل پارس‌پک

اگر Secrets کلادفلر تنظیم نشده باشند، Workflow داده‌ای صادر نمی‌کند و در Summary هشدار ثبت می‌کند.

## اجرای Migration

قبل از هر انتشار Production:

```bash
npm run db:migrations:check
npm run db:backup
npm run db:migrations:apply
npm run deploy:check
```

Migration حفاظت داده:

```text
migrations/0099_evaluation_data_protection.sql
```

این Migration افزایشی است و هیچ جدول یا رکورد فعلی را حذف نمی‌کند.

## بازیابی سریع با Time Travel

قبل از Restore، ابتدا Worker Production را در حالت نگهداری قرار دهید و Bookmark فعلی را ثبت کنید.

```bash
npx wrangler d1 time-travel info salamat-aval-caregiver-club --config wrangler.backend.jsonc
```

بازیابی با Bookmark یا Timestamp یک عملیات مخرب و In-place است و فقط پس از تأیید مدیر فنی انجام می‌شود:

```bash
npx wrangler d1 time-travel restore salamat-aval-caregiver-club --bookmark=<BOOKMARK> --config wrangler.backend.jsonc
```

Rollback کد Worker، دیتابیس را Rollback نمی‌کند. نسخه کد و وضعیت دیتابیس باید جداگانه بررسی شوند.

## بازیابی از Export بلندمدت

هیچ فایل بک‌آپ ابتدا روی Production Import نمی‌شود. Workflow زیر باید اجرا شود:

```text
D1 Restore Drill
```

این Workflow:

1. از Production خروجی می‌گیرد.
2. یک D1 موقت و جدا ایجاد می‌کند.
3. فایل SQL را در دیتابیس موقت Import می‌کند.
4. تعداد دوره‌ها، امتیازها، Revisionها، Snapshotها و رخدادهای بایگانی را مقایسه می‌کند.
5. شواهد آزمون را به‌عنوان Artifact ذخیره می‌کند.
6. دیتابیس موقت را حذف می‌کند.

بازیابی روی Production فقط بعد از موفقیت Restore Drill و ثبت زمان قطعی قابل قبول است.

## کنترل سلامت پس از انتشار

پس از Deploy و اجرای Migration:

1. با حساب مدیر اصلی وارد شوید.
2. `GET /api/admin/evaluation-protection/health` را اجرا کنید.
3. مقادیر زیر باید صفر باشند:
   - `finalWithoutSnapshot`
   - `scoresWithoutRevision`
   - `orphanScores`
   - `snapshotHashes.mismatches.length`
4. یک ارزیابی آزمایشی را امتیازدهی، اصلاح و نهایی کنید.
5. Health را دوباره اجرا کنید.
6. Workflow بک‌آپ را دستی اجرا و Artifact را دانلود و Checksum را بررسی کنید.
7. Workflow Restore Drill را اجرا کنید.

## واکنش به حادثه

### حذف یا تغییر اشتباه امتیاز

حذف مستقیم با Trigger مسدود می‌شود. برای تغییر اشتباه، Revisionهای همان `evaluation_id` و `criterion_code` بررسی و مقدار صحیح با یک اصلاح جدید ثبت می‌شود. Revision قبلی هرگز ویرایش نمی‌شود.

### خرابی نسخه جدید Worker

Worker را به نسخه سالم قبلی Rollback کنید؛ سپس Health دیتابیس را بررسی کنید. اگر Migration جدید ساختار داده را تغییر داده، Rollback کد بدون بررسی سازگاری دیتابیس ممنوع است.

### خرابی یا حذف گسترده داده

1. تمام عملیات نوشتن متوقف شود.
2. Bookmark و زمان حادثه ثبت شود.
3. Restore Drill روی Export یا Bookmark انتخابی اجرا شود.
4. پس از تأیید شمارش و Hashها، Restore Production انجام شود.
5. Health و کارنامه‌های نمونه بررسی شوند.
6. گزارش حادثه و علت ریشه‌ای ثبت شود.

## ممنوعیت‌ها

- ذخیره ارزیابی واقعی فقط در LocalStorage
- حذف مستقیم مراقب، دوره یا امتیاز با SQL
- ویرایش Snapshot یا Revision
- Import بک‌آپ روی Production بدون Restore Drill
- اجرای Migration بدون بک‌آپ و Bookmark
- ذخیره Secrets یا بک‌آپ حاوی داده شخصی در Git Repository
