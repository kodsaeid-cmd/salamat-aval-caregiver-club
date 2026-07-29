"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  ChevronLeft,
  CircleUserRound,
  FileCheck2,
  ImagePlus,
  MapPin,
  Paperclip,
  Save,
  Send,
  Sparkles,
  UploadCloud,
  UserPlus,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";

const skillOptions = [
  "کمک به بهداشت",
  "کنترل علائم حیاتی",
  "تزریقات",
  "مراقبت از زخم",
  "جابجایی سالمند",
  "تغذیه و دارو",
];

const shifts = [
  { id: "MORNING", label: "صبح (۷ تا ۱۴)" },
  { id: "EVENING", label: "عصر (۱۴ تا ۲۱)" },
  { id: "NIGHT", label: "شب (۲۱ تا ۷)" },
  { id: "PART_TIME", label: "پاره‌وقت" },
  { id: "FULL_TIME", label: "تمام‌وقت" },
  { id: "HOLIDAY", label: "روزهای تعطیل" },
];

export function CaregiverProfileForm() {
  const [primaryType, setPrimaryType] = useState("ELDERLY");
  const [selectedSkills, setSelectedSkills] = useState<string[]>(["کمک به بهداشت"]);
  const [selectedShifts, setSelectedShifts] = useState<string[]>(["EVENING", "HOLIDAY"]);
  const [recruiterId, setRecruiterId] = useState("u3");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users")
      .then((response) => response.json())
      .then((payload) => {
        const recruiter = payload.data?.find((user: { role: string }) => user.role === "RECRUITER");
        if (recruiter?.id) setRecruiterId(recruiter.id);
      })
      .catch(() => undefined);
  }, []);

  function toggleSkill(skill: string) {
    setSelectedSkills((current) =>
      current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill],
    );
  }

  function toggleShift(shift: string) {
    setSelectedShifts((current) =>
      current.includes(shift) ? current.filter((item) => item !== shift) : [...current, shift],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const saveAsDraft = submitter?.dataset.action === "draft";
    const form = new FormData(event.currentTarget);
    const salary = String(form.get("salaryExpectation") ?? "").replace(/[,٬\s]/g, "");

    const payload = {
      fullName: form.get("fullName"),
      mobile: form.get("mobile"),
      birthDate: form.get("birthDate") || undefined,
      gender: form.get("gender") || undefined,
      maritalStatus: form.get("maritalStatus") || undefined,
      primaryType,
      skills: selectedSkills,
      workHistory: form.get("workHistory") || undefined,
      province: form.get("province") || undefined,
      city: form.get("city") || undefined,
      serviceRegion: form.get("serviceRegion") || undefined,
      acceptedShifts: selectedShifts,
      startAvailability: form.get("startAvailability") || undefined,
      cooperationType: form.get("cooperationType") || undefined,
      salaryExpectation: salary ? Number(salary) : undefined,
      recruiterId,
      saveAsDraft,
    };

    try {
      const response = await fetch("/api/caregivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "ثبت پروفایل انجام نشد");
      setMessage(saveAsDraft ? "پروفایل به‌صورت پیش‌نویس ذخیره شد." : `پروفایل با کد ${result.data.membershipCode} ثبت شد.`);
      if (!saveAsDraft) event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "خطا در ثبت پروفایل");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="recruitment-page">
        <div className="breadcrumb">
          <span>جذب و استخدام</span><ChevronLeft size={15} /><span>پروفایل مراقبین</span><ChevronLeft size={15} /><strong>ثبت پروفایل مراقب</strong>
        </div>

        <div className="page-heading">
          <div>
            <span className="eyebrow">باشگاه مراقبین سلامت اول</span>
            <h1>ثبت پروفایل مراقب</h1>
            <p>اطلاعات اولیه متقاضی را ثبت کنید تا فرآیند بررسی، مصاحبه و ارزیابی آغاز شود.</p>
          </div>
          <div className="role-chip"><UserPlus size={18} /><div><span>نقش فعال</span><strong>کاربر جذب</strong></div></div>
        </div>

        <div className="recruitment-layout">
          <aside className="recruiter-info panel panel--soft">
            <div className="recruiter-info__title"><div className="avatar avatar--blue">م</div><div><strong>مهدی رضایی</strong><span>کاربر جذب</span></div></div>
            <div className="info-callout"><CircleUserRound size={20} /><div><strong>حوزه کاری شما</strong><p>ثبت و ارزیابی اولیه مراقبین</p></div></div>
            <h3>دسترسی‌های شما</h3>
            <ul className="access-list">
              <li><Check /> افزودن پروفایل مراقب</li>
              <li><Check /> مشاهده پروفایل‌ها</li>
              <li><Check /> پیگیری وضعیت جذب</li>
              <li><Check /> گزارش‌های جذب</li>
            </ul>
          </aside>

          <form className="caregiver-form" onSubmit={handleSubmit}>
            <section className="form-card form-card--profile">
              <div className="form-card__heading"><ImagePlus /><div><h2>عکس و مدارک</h2><p>تصویر واضح و مدارک معتبر بارگذاری شود.</p></div></div>
              <label className="upload-box">
                <UploadCloud size={30} /><strong>بارگذاری عکس پروفایل</strong><span>JPG یا PNG، حداکثر ۲ مگابایت</span><input type="file" accept="image/png,image/jpeg" />
              </label>
              <div className="document-list">
                {['کارت ملی','مدرک تحصیلی','گواهی عدم سوء پیشینه','گواهی سلامت'].map((document) => (
                  <label key={document} className="document-row"><span><Paperclip size={16} />{document}</span><em>بارگذاری</em><input type="file" /></label>
                ))}
              </div>
            </section>

            <section className="form-card form-card--personal">
              <div className="form-card__heading"><CircleUserRound /><div><h2>اطلاعات فردی</h2><p>مشخصات هویتی و راه ارتباطی مراقب.</p></div></div>
              <div className="form-grid form-grid--2">
                <label>نام و نام خانوادگی <b>*</b><input required name="fullName" placeholder="مثال: فاطمه احمدی" /></label>
                <label>شماره موبایل <b>*</b><input required name="mobile" inputMode="tel" placeholder="مثال: 09121234567" /></label>
                <label>تاریخ تولد<input type="date" name="birthDate" /></label>
                <label>جنسیت<select name="gender" defaultValue=""><option value="" disabled>انتخاب کنید</option><option value="FEMALE">زن</option><option value="MALE">مرد</option></select></label>
                <label>وضعیت تأهل<select name="maritalStatus" defaultValue=""><option value="" disabled>انتخاب کنید</option><option value="SINGLE">مجرد</option><option value="MARRIED">متأهل</option></select></label>
              </div>
            </section>

            <section className="form-card form-card--skills">
              <div className="form-card__heading"><Sparkles /><div><h2>مهارت‌ها و تخصص‌ها</h2><p>نوع مراقبت و توانمندی‌های قابل ارائه.</p></div></div>
              <span className="field-label">نوع مراقب <b>*</b></span>
              <div className="segmented-control">
                <button type="button" className={primaryType === "ELDERLY" ? "active" : ""} onClick={() => setPrimaryType("ELDERLY")}>مراقب سالمند</button>
                <button type="button" className={primaryType === "PATIENT" ? "active" : ""} onClick={() => setPrimaryType("PATIENT")}>مراقب بیمار</button>
                <button type="button" className={primaryType === "CHILD" ? "active" : ""} onClick={() => setPrimaryType("CHILD")}>مراقب کودک</button>
              </div>
              <span className="field-label">مهارت‌ها</span>
              <div className="skill-grid">
                {skillOptions.map((skill) => <button type="button" key={skill} className={selectedSkills.includes(skill) ? "skill-chip skill-chip--selected" : "skill-chip"} onClick={() => toggleSkill(skill)}>{selectedSkills.includes(skill) && <Check size={14} />}{skill}</button>)}
              </div>
              <label>سوابق کاری<textarea name="workHistory" rows={4} placeholder="توضیحات سوابق کاری، نوع پرونده‌ها و مدت فعالیت" /></label>
            </section>

            <section className="form-card form-card--location">
              <div className="form-card__heading"><MapPin /><div><h2>محدوده خدمت</h2><p>مناطق و محل‌های قابل پذیرش پرونده.</p></div></div>
              <div className="form-grid form-grid--2">
                <label>استان<select name="province" defaultValue="تهران"><option>تهران</option><option>البرز</option></select></label>
                <label>شهر<select name="city" defaultValue="تهران"><option>تهران</option><option>کرج</option></select></label>
              </div>
              <label>محدوده، محله یا منطقه<input name="serviceRegion" placeholder="مثال: شمال تهران، سعادت‌آباد" /></label>
            </section>

            <section className="form-card form-card--shift">
              <div className="form-card__heading"><BriefcaseBusiness /><div><h2>شرایط همکاری</h2><p>شیفت‌ها، زمان شروع و نوع همکاری.</p></div></div>
              <span className="field-label">شیفت‌های قابل قبول</span>
              <div className="checkbox-grid">
                {shifts.map((shift) => <label key={shift.id} className="check-card"><input type="checkbox" checked={selectedShifts.includes(shift.id)} onChange={() => toggleShift(shift.id)} /><span>{shift.label}</span></label>)}
              </div>
              <div className="form-grid form-grid--2">
                <label>آمادگی شروع همکاری<select name="startAvailability" defaultValue="IMMEDIATE"><option value="IMMEDIATE">فوری</option><option value="ONE_WEEK">یک هفته آینده</option><option value="TWO_WEEKS">دو هفته آینده</option></select></label>
                <label>نوع همکاری<select name="cooperationType" defaultValue="FULL_TIME"><option value="FULL_TIME">تمام‌وقت</option><option value="PART_TIME">پاره‌وقت</option><option value="PROJECT">پرونده‌ای</option></select></label>
              </div>
              <label>انتظارات حقوقی<input name="salaryExpectation" inputMode="numeric" placeholder="مثال: ۱۵٬۰۰۰٬۰۰۰ تومان" /></label>
            </section>

            {message && <div className={message.includes("ثبت شد") || message.includes("ذخیره شد") ? "form-message form-message--success form-message--wide" : "form-message form-message--wide"}>{message}</div>}

            <div className="form-actions">
              <button className="button button--primary" type="submit" disabled={submitting}><Send size={18} />{submitting ? "در حال ثبت..." : "ثبت پروفایل"}</button>
              <button className="button button--secondary" type="submit" data-action="draft" disabled={submitting}><Save size={18} />ذخیره موقت</button>
              <button className="button button--link" type="button"><ArrowLeft size={17} />انصراف و بازگشت</button>
            </div>
          </form>

          <aside className="recruitment-steps panel panel--soft">
            <div className="recruitment-steps__title"><BadgeCheck size={20} /><h3>فرآیند جذب مراقب</h3></div>
            <ol>
              <li className="active"><i>۱</i><div><strong>ثبت پروفایل</strong><span>اطلاعات و مدارک اولیه</span></div></li>
              <li><i>۲</i><div><strong>بررسی اولیه</strong><span>کنترل مدارک و شرایط</span></div></li>
              <li><i>۳</i><div><strong>تماس و مصاحبه</strong><span>هماهنگی و مصاحبه</span></div></li>
              <li><i>۴</i><div><strong>ارزیابی و تأیید</strong><span>ارزیابی حرفه‌ای</span></div></li>
              <li><i>۵</i><div><strong>فعال‌سازی</strong><span>عضویت در باشگاه</span></div></li>
            </ol>
            <div className="process-note"><FileCheck2 size={22} /><p>پس از ثبت، پروفایل برای بررسی مدیر عملیات ارسال می‌شود.</p></div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
