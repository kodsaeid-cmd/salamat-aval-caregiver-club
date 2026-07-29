"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BookOpenCheck, CheckCircle2, ChevronLeft, ClipboardCheck, Clock3, Search, TrendingUp, UserRoundCheck } from "lucide-react";

const queue = [
  { id: "SA-1405-0914", name: "رضا کریمی", level: "پایه", score: 68, events: 5, tone: "orange" },
  { id: "SA-1405-1028", name: "مریم حسینی", level: "حرفه‌ای", score: 84, events: 2, tone: "green" },
  { id: "SA-1405-0840", name: "سمیرا محمدی", level: "ارشد", score: 91, events: 1, tone: "blue" },
  { id: "SA-1405-1113", name: "محمد صادقی", level: "حرفه‌ای", score: 82, events: 3, tone: "green" },
];

const indicators = [
  ["کیفیت ارائه خدمات", 71],
  ["رضایت خانواده", 62],
  ["رعایت کرامت سالمند", 84],
  ["اخلاق و رفتار حرفه‌ای", 78],
  ["انضباط شغلی", 56],
  ["همکاری سازمانی", 76],
  ["رعایت استانداردها", 72],
  ["مشارکت آموزشی", 60],
] as const;

export function EvaluationsDashboard() {
  const [selected, setSelected] = useState(queue[0]);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => queue.filter((item) => `${item.name} ${item.id}`.includes(query)), [query]);

  return (
    <div className="evaluation-page">
      <div className="page-heading">
        <div><span className="eyebrow">نظام پایش و ارزیابی</span><h1>مرکز ارزیابی مراقبین</h1><p>بررسی مستندات، امتیازدهی شاخص‌های هشت‌گانه و تولید کارنامه حرفه‌ای.</p></div>
        <button type="button" className="button button--primary"><ClipboardCheck size={18} /> شروع دوره ارزیابی</button>
      </div>

      <div className="stats-grid">
        <article className="stat-card"><div className="stat-card__icon stat-card__icon--red"><AlertTriangle /></div><div><span>ارزیابی‌های باز</span><strong>۲۴</strong><small>۶ مورد نزدیک سررسید</small></div></article>
        <article className="stat-card"><div className="stat-card__icon"><Clock3 /></div><div><span>در انتظار تأیید</span><strong>۱۱</strong><small>نیازمند اقدام مدیر عملیات</small></div></article>
        <article className="stat-card"><div className="stat-card__icon"><CheckCircle2 /></div><div><span>نهایی‌شده این ماه</span><strong>۱۸۶</strong><small>نرخ تکمیل ۹۴٪</small></div></article>
        <article className="stat-card"><div className="stat-card__icon"><TrendingUp /></div><div><span>میانگین شبکه</span><strong>۸۱.۶</strong><small>۲.۴+ نسبت به دوره قبل</small></div></article>
      </div>

      <div className="evaluation-workspace">
        <section className="panel evaluation-queue">
          <div className="panel__header"><div><h2>صف ارزیابی</h2><span>{filtered.length} مراقب نیازمند بررسی</span></div></div>
          <div className="evaluation-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی نام یا کد عضویت" /></div>
          <div className="evaluation-queue__list">
            {filtered.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelected(item)} className={selected.id === item.id ? "evaluation-person evaluation-person--active" : "evaluation-person"}>
                <div className={`avatar avatar--${item.tone}`}>{item.name.slice(0, 1)}</div>
                <div><strong>{item.name}</strong><span>{item.level} · <span className="ltr-text">{item.id}</span></span><small>{item.events} رویداد جدید</small></div>
                <b>{item.score}</b><ChevronLeft size={16} />
              </button>
            ))}
          </div>
        </section>

        <section className="panel evaluation-review">
          <div className="evaluation-review__head">
            <div className="avatar avatar--orange evaluation-avatar">{selected.name.slice(0, 1)}</div>
            <div><span className="eyebrow">دوره فروردین ۱۴۰۵</span><h2>ارزیابی {selected.name}</h2><p><span className="ltr-text">{selected.id}</span> · آخرین بروزرسانی امروز</p></div>
            <div className="review-score"><strong>{selected.score}</strong><span>امتیاز فعلی</span></div>
          </div>

          <div className="indicator-grid">
            {indicators.map(([label, value]) => <div className="indicator-item" key={label}><div><span>{label}</span><strong>{value}</strong></div><i><u className={value < 60 ? "danger" : value < 70 ? "warning" : ""} style={{ width: `${value}%` }} /></i></div>)}
          </div>

          <div className="evidence-list">
            <div className="evidence-list__title"><div><h3>مستندات و رویدادهای مؤثر</h3><p>فقط رویدادهای تأییدشده در امتیاز نهایی اثر می‌گذارند.</p></div><button type="button" className="button button--ghost">افزودن مستند</button></div>
            <article><i className="evidence-score evidence-score--negative">۳−</i><div><strong>تأخیر غیرموجه در شروع شیفت</strong><span>ثبت‌شده توسط پشتیبانی · ۱۴۰۵/۰۱/۱۸</span></div><span className="role-badge role-badge--support">تأییدشده</span><button type="button" className="icon-button icon-button--border"><ChevronLeft size={16} /></button></article>
            <article><i className="evidence-score evidence-score--positive">۵+</i><div><strong>رضایت خانواده از نحوه ارتباط</strong><span>فرم نظرسنجی پرونده ۱۵۲۷-۲۸۸۱</span></div><span className="role-badge role-badge--operations">تأییدشده</span><button type="button" className="icon-button icon-button--border"><ChevronLeft size={16} /></button></article>
            <article><i className="evidence-score evidence-score--neutral"><BookOpenCheck size={16} /></i><div><strong>آموزش مدیریت زمان تکمیل نشده</strong><span>مهلت تکمیل: ۱۴۰۵/۰۲/۱۰</span></div><span className="role-badge role-badge--recruiter">در انتظار</span><button type="button" className="icon-button icon-button--border"><ChevronLeft size={16} /></button></article>
          </div>

          <div className="evaluation-actions"><Link href={`/caregivers/${selected.id}`} className="button button--ghost"><UserRoundCheck size={17} /> پروفایل مراقب</Link><button type="button" className="button button--ghost">ثبت یادداشت</button><button type="button" className="button button--primary"><CheckCircle2 size={17} /> نهایی‌سازی کارنامه</button></div>
        </section>
      </div>
    </div>
  );
}