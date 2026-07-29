"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Download,
  Filter,
  MoreVertical,
  Plus,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";
import { demoUsers, roleLabels, toPersianNumber } from "@/lib/domain";

type UserRow = {
  id: string;
  fullName: string;
  username: string;
  mobile?: string;
  role: string;
  status: string;
  createdAt: string | Date;
};

const permissions = [
  { id: "caregiver.create", label: "افزودن پروفایل مراقب" },
  { id: "caregiver.read", label: "مشاهده پروفایل مراقبین" },
  { id: "caregiver.approve", label: "تأیید مراقب" },
  { id: "evaluation.manage", label: "مدیریت ارزیابی‌ها" },
  { id: "course.manage", label: "مدیریت آموزش‌ها" },
  { id: "ticket.manage", label: "مدیریت پشتیبانی" },
];

export function AdminUsersDashboard() {
  const [users, setUsers] = useState<UserRow[]>(demoUsers);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/users")
      .then((response) => response.json())
      .then((payload) => {
        if (Array.isArray(payload.data)) setUsers(payload.data);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const activeUsers = useMemo(() => users.filter((user) => user.status === "ACTIVE").length, [users]);

  function formatDate(value: string | Date) {
    if (typeof value === "string" && /^14\d{2}\//.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(date);
  }

  function togglePermission(permission: string) {
    setSelectedPermissions((current) =>
      current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      fullName: form.get("fullName"),
      mobile: form.get("mobile"),
      username: form.get("username"),
      password: form.get("password"),
      role: form.get("role"),
      status: form.get("status"),
      permissions: selectedPermissions,
    };

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "ثبت کاربر انجام نشد");
      setUsers((current) => [result.data, ...current]);
      setMessage("کاربر با موفقیت ایجاد شد.");
      setSelectedPermissions([]);
      event.currentTarget.reset();
      window.setTimeout(() => setDrawerOpen(false), 900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "خطا در ثبت کاربر");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">مرکز مدیریت باشگاه</span>
          <h1>مدیریت کاربران و نقش‌ها</h1>
          <p>ایجاد کاربران سازمانی، تخصیص نقش و کنترل دسترسی به فرآیندهای باشگاه مراقبین.</p>
        </div>
        <button className="button button--primary" type="button" onClick={() => setDrawerOpen(true)}>
          <Plus size={18} />
          افزودن کاربر
        </button>
      </div>

      <section className="stats-grid" aria-label="آمار کاربران">
        <article className="stat-card">
          <div className="stat-card__icon stat-card__icon--red"><UsersRound /></div>
          <div><span>تعداد کاربران</span><strong>{toPersianNumber(users.length || 453)}</strong><small>۱۲+ نسبت به ماه قبل</small></div>
        </article>
        <article className="stat-card">
          <div className="stat-card__icon"><UserRoundCheck /></div>
          <div><span>کاربران فعال</span><strong>{toPersianNumber(activeUsers || 236)}</strong><small>۸۵٪ از کل کاربران</small></div>
        </article>
        <article className="stat-card">
          <div className="stat-card__icon"><CheckCircle2 /></div>
          <div><span>مراقبین ثبت‌شده</span><strong>۱٬۲۸۷</strong><small>۵۶+ نسبت به ماه قبل</small></div>
        </article>
        <article className="stat-card">
          <div className="stat-card__icon stat-card__icon--red"><ClipboardList /></div>
          <div><span>ارزیابی‌های باز</span><strong className="text-red">۲۴</strong><small>۸+ نسبت به هفته قبل</small></div>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>کاربران سازمانی</h2>
            <span>{loading ? "در حال دریافت اطلاعات..." : `${toPersianNumber(users.length)} کاربر نمایش داده می‌شود`}</span>
          </div>
          <div className="toolbar">
            <button className="button button--ghost" type="button"><Filter size={17} /> فیلترها</button>
            <button className="icon-button icon-button--border" type="button" aria-label="دریافت خروجی"><Download size={18} /></button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>نام کاربر</th><th>نام کاربری</th><th>نقش</th><th>وضعیت</th><th>تاریخ ایجاد</th><th>اقدامات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={user.id}>
                  <td><div className="person-cell"><div className={`avatar avatar--${index % 3}`}>{user.fullName.slice(0, 1)}</div><div><strong>{user.fullName}</strong><span>{user.mobile ?? "بدون شماره"}</span></div></div></td>
                  <td><span className="ltr-text">{user.username}</span></td>
                  <td><span className={`role-badge role-badge--${user.role.toLowerCase()}`}>{roleLabels[user.role] ?? user.role}</span></td>
                  <td><span className={user.status === "ACTIVE" ? "status status--active" : "status status--inactive"}><i />{user.status === "ACTIVE" ? "فعال" : "غیرفعال"}</span></td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td><button type="button" className="icon-button" aria-label={`اقدامات ${user.fullName}`}><MoreVertical size={18} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel__footer"><span>نمایش ۱ تا {toPersianNumber(users.length)} مورد</span><div className="pagination"><button>‹</button><button className="active">۱</button><button>۲</button><button>۳</button><button>›</button></div></div>
      </section>

      {drawerOpen && <button className="drawer-backdrop" aria-label="بستن پنجره" onClick={() => setDrawerOpen(false)} />}
      <aside className={drawerOpen ? "drawer drawer--open" : "drawer"} aria-hidden={!drawerOpen}>
        <div className="drawer__header"><div><span className="eyebrow">مدیریت دسترسی</span><h2>افزودن کاربر جدید</h2></div><button className="icon-button" onClick={() => setDrawerOpen(false)}><X /></button></div>
        <form onSubmit={handleSubmit} className="form-stack">
          <label>نام و نام خانوادگی<input name="fullName" required placeholder="مثال: زهرا موسوی" /></label>
          <label>شماره موبایل<input name="mobile" required inputMode="tel" placeholder="مثال: 09121234567" /></label>
          <label>نام کاربری<input name="username" required dir="ltr" placeholder="z.mousavi" /></label>
          <label>رمز عبور اولیه<input name="password" required type="password" minLength={6} placeholder="حداقل ۶ کاراکتر" /></label>
          <div className="form-grid form-grid--2">
            <label>نقش<select name="role" defaultValue="RECRUITER"><option value="ADMIN">ادمین</option><option value="OPERATIONS">مدیر عملیات</option><option value="RECRUITER">کاربر جذب</option><option value="SUPPORT">پشتیبان</option><option value="EVALUATOR">ارزیاب</option><option value="EDUCATION">کارشناس آموزش</option><option value="HR">منابع انسانی</option></select></label>
            <label>وضعیت<select name="status" defaultValue="ACTIVE"><option value="ACTIVE">فعال</option><option value="INACTIVE">غیرفعال</option></select></label>
          </div>
          <fieldset className="permission-box"><legend><ShieldCheck size={17} /> دسترسی‌ها</legend>{permissions.map((permission) => <label key={permission.id} className="check-row"><input type="checkbox" checked={selectedPermissions.includes(permission.id)} onChange={() => togglePermission(permission.id)} /><span>{permission.label}</span></label>)}</fieldset>
          {message && <div className={message.includes("موفقیت") ? "form-message form-message--success" : "form-message"}>{message}</div>}
          <div className="drawer__actions"><button className="button button--primary" disabled={submitting} type="submit"><Activity size={17} />{submitting ? "در حال ذخیره..." : "ذخیره کاربر"}</button><button className="button button--ghost" type="button" onClick={() => setDrawerOpen(false)}>انصراف</button></div>
        </form>
      </aside>
    </div>
  );
}
