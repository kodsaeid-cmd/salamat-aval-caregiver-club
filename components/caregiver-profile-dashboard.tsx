import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileBadge2,
  HeartHandshake,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  TrendingUp,
} from "lucide-react";

const scoreItems = [
  ["کیفیت ارائه خدمات", 88],
  ["رضایت خانواده", 92],
  ["رعایت کرامت سالمند", 95],
  ["اخلاق و رفتار حرفه‌ای", 90],
  ["انضباط شغلی", 79],
  ["همکاری سازمانی", 84],
  ["رعایت استانداردها", 86],
  ["مشارکت آموزشی", 82],
] as const;

const events = [
  { value: "+۵", title: "رضایت کامل خانواده پرونده ۱۵۲۷-۲۸۳۱", date: "۲ روز قبل", tone: "green" },
  { value: "+۱۰", title: "تکمیل کارگاه مراقبت از سالمند کم‌تحرک", date: "۶ روز قبل", tone: "blue" },
  { value: "یادآوری", title: "پروانه صلاحیت تا ۳۱ خرداد اعتبار دارد", date: "نیازمند پیگیری", tone: "orange" },
];

export function CaregiverProfileDashboard({ id }: { id: string }) {
  return (
    <div className="profile-page">
      <div className="page-heading profile-page__heading">
        <div>
          <Link href="/caregivers" className="back-link"><ArrowRight size={16} /> بازگشت به مراقبین</Link>
          <h1>پروفایل ۳۶۰ درجه مراقب</h1>
          <p>نمای یکپارچه عضویت، ارزیابی، آموزش، پرونده‌ها و صلاحیت حرفه‌ای.</p>
        </div>
        <div className="profile-heading-actions">
          <button type="button" className="button button--ghost"><ClipboardList size={17} /> ثبت رویداد</button>
          <Link href="/evaluations" className="button button--primary"><TrendingUp size={17} /> شروع ارزیابی</Link>
        </div>
      </div>

      <section className="profile-hero panel">
        <div className="profile-hero__identity">
          <div className="profile-avatar">م</div>
          <div>
            <div className="profile-badges"><span className="role-badge role-badge--operations">مراقب حرفه‌ای</span><span className="status status--active"><i />فعال</span></div>
            <h2>مریم حسینی</h2>
            <p><span className="ltr-text">SA-1405-1028</span> · عضو باشگاه از تیر ۱۴۰۲</p>
            <div className="profile-contact"><span><Phone size={14} /> ۰۹۱۲۱۲۳۴۵۶۷</span><span><MapPin size={14} /> تهران، مناطق ۱ تا ۵</span></div>
          </div>
        </div>
        <div className="professional-score"><strong>۸۴</strong><span>امتیاز حرفه‌ای</span><small>۴+ نسبت به دوره قبل</small></div>
        <div className="license-card"><ShieldCheck size={28} /><div><strong>پروانه معتبر</strong><span>اعتبار تا ۱۴۰۵/۰۳/۳۱</span></div></div>
      </section>

      <div className="profile-kpis">
        <article><HeartHandshake /><strong>۲۷</strong><span>پرونده موفق</span></article>
        <article><Star /><strong>۹۲٪</strong><span>رضایت خانواده</span></article>
        <article><BookOpenCheck /><strong>۱۲۰</strong><span>اعتبار آموزشی</span></article>
        <article><Award /><strong>۷۲٪</strong><span>مسیر تا رتبه ارشد</span></article>
      </div>

      <div className="profile-layout">
        <div className="profile-main-column">
          <section className="panel profile-section">
            <div className="panel__header"><div><h2>کارنامه حرفه‌ای دوره جاری</h2><span>دوره ارزیابی فروردین ۱۴۰۵</span></div><button type="button" className="button button--ghost">مشاهده جزئیات</button></div>
            <div className="score-grid">
              {scoreItems.map(([label, value]) => (
                <div className="score-item" key={label}>
                  <div><span>{label}</span><strong>{value}</strong></div>
                  <div className="score-track"><i style={{ width: `${value}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel profile-section">
            <div className="panel__header"><div><h2>رویدادهای حرفه‌ای اخیر</h2><span>تغییرات مؤثر بر کارنامه و مسیر رشد</span></div></div>
            <div className="professional-events">
              {events.map((event) => <div key={event.title}><i className={`event-value event-value--${event.tone}`}>{event.value}</i><div><strong>{event.title}</strong><span>{event.date}</span></div><button type="button" className="button button--ghost">مشاهده</button></div>)}
            </div>
          </section>
        </div>

        <aside className="profile-side-column">
          <section className="panel profile-section growth-card">
            <div className="growth-icon"><Award /></div>
            <h3>مسیر ارتقا به رتبه ارشد</h3>
            <p>برای ارتقا، شرایط زیر باید تکمیل شود:</p>
            <ul><li className="done"><CheckCircle2 /> حداقل ۸۰ امتیاز حرفه‌ای</li><li className="done"><CheckCircle2 /> رضایت خانواده بالاتر از ۸۵٪</li><li><CalendarClock /> تکمیل دوره مراقبت تخصصی</li><li><FileBadge2 /> تمدید پروانه صلاحیت</li></ul>
            <div className="growth-progress"><div><span>پیشرفت</span><strong>۷۲٪</strong></div><i><u style={{ width: "72%" }} /></i></div>
          </section>

          <section className="panel profile-section">
            <h3>مهارت‌ها و تخصص‌ها</h3>
            <div className="profile-tags"><span>مراقب سالمند</span><span>بیمار آلزایمر</span><span>کنترل علائم حیاتی</span><span>شبانه‌روزی</span><span>کمک‌های اولیه</span></div>
          </section>

          <section className="panel profile-section">
            <h3>اطلاعات سیستمی</h3>
            <dl className="system-info"><div><dt>شناسه پروفایل</dt><dd className="ltr-text">{id}</dd></div><div><dt>وضعیت همکاری</dt><dd>فعال</dd></div><div><dt>آخرین ارزیابی</dt><dd>۱۴۰۵/۰۱/۲۸</dd></div><div><dt>پشتیبان مسئول</dt><dd>سارا احمدی</dd></div></dl>
          </section>
        </aside>
      </div>
    </div>
  );
}