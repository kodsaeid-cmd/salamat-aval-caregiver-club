"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Filter, Plus, Search, UserRoundCheck } from "lucide-react";
import { demoCaregivers, stageLabels, toPersianNumber } from "@/lib/domain";

type CaregiverRow = {
  id: string;
  membershipCode: string;
  fullName: string;
  mobile: string;
  primaryType: string;
  recruitmentStage: string;
  professionalLevel: string;
  professionalScore: number;
  clubPoints: number;
  active: boolean;
};

const typeLabels: Record<string, string> = {
  ELDERLY: "مراقب سالمند",
  PATIENT: "مراقب بیمار",
  CHILD: "مراقب کودک",
};

const levelLabels: Record<string, string> = {
  NEW: "عضو جدید",
  BASIC: "پایه",
  PROFESSIONAL: "حرفه‌ای",
  SENIOR: "ارشد",
  EXCELLENT: "ممتاز",
};

export function CaregiversDashboard() {
  const [caregivers, setCaregivers] = useState<CaregiverRow[]>(demoCaregivers);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/caregivers")
      .then((response) => response.json())
      .then((payload) => {
        if (Array.isArray(payload.data)) setCaregivers(payload.data);
      })
      .catch(() => undefined);
  }, []);

  const filtered = caregivers.filter((caregiver) =>
    `${caregiver.fullName} ${caregiver.mobile} ${caregiver.membershipCode}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">پروفایل ۳۶۰ درجه مراقب</span>
          <h1>پروفایل مراقبین</h1>
          <p>مدیریت چرخه عضویت، جذب، ارزیابی و رشد حرفه‌ای اعضای باشگاه مراقبین.</p>
        </div>
        <Link href="/recruitment/caregivers/new" className="button button--primary"><Plus size={18} /> افزودن مراقب</Link>
      </div>

      <section className="panel">
        <div className="panel__header">
          <div><h2>اعضای باشگاه</h2><span>{toPersianNumber(filtered.length)} پروفایل</span></div>
          <div className="toolbar">
            <div className="search-box search-box--table"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی نام، موبایل یا کد عضویت" /></div>
            <button className="button button--ghost" type="button"><Filter size={17} /> فیلتر</button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>مراقب</th><th>کد عضویت</th><th>تخصص</th><th>مرحله جذب</th><th>رتبه حرفه‌ای</th><th>امتیاز باشگاه</th><th>وضعیت</th><th>مشاهده</th></tr></thead>
            <tbody>
              {filtered.map((caregiver, index) => (
                <tr key={caregiver.id}>
                  <td><div className="person-cell"><div className={`avatar avatar--${index % 3}`}>{caregiver.fullName.slice(0, 1)}</div><div><strong>{caregiver.fullName}</strong><span>{caregiver.mobile}</span></div></div></td>
                  <td><span className="ltr-text">{caregiver.membershipCode}</span></td>
                  <td><span className="role-badge role-badge--operations">{typeLabels[caregiver.primaryType] ?? caregiver.primaryType}</span></td>
                  <td>{stageLabels[caregiver.recruitmentStage] ?? caregiver.recruitmentStage}</td>
                  <td>{levelLabels[caregiver.professionalLevel] ?? caregiver.professionalLevel} {caregiver.professionalScore > 0 && <small>({toPersianNumber(caregiver.professionalScore)})</small>}</td>
                  <td><strong>{toPersianNumber(caregiver.clubPoints)}</strong></td>
                  <td><span className={caregiver.active ? "status status--active" : "status status--inactive"}><i />{caregiver.active ? "فعال" : "در حال جذب"}</span></td>
                  <td><button type="button" className="icon-button icon-button--border" aria-label={`مشاهده ${caregiver.fullName}`}><Eye size={17} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="empty-state"><UserRoundCheck /><h3>موردی پیدا نشد</h3><p>عبارت جست‌وجو یا فیلترهای انتخابی را تغییر دهید.</p></div>}
      </section>
    </div>
  );
}
