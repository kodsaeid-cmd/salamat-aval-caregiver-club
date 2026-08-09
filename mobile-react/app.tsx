import React, { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BadgeCheck, BookOpen, CalendarDays, ChevronLeft, CircleUserRound, ClipboardCheck,
  FileText, Gift, Headphones, Home, LogOut, Menu, MessageCircle, PhoneCall,
  RefreshCw, Save, ShieldCheck, Sparkles, Upload, UserRound, WalletCards, X,
} from "lucide-react";
import "./mobile.css";

type RouteKey = "home" | "profile" | "wallet" | "training" | "scorecard" | "contract" | "shifts" | "support" | "benefits";
type Notify = (message: string, tone?: "success" | "error" | "info") => void;

type ApiError = Error & { status?: number; code?: string; detail?: unknown };

const ROUTES: Record<RouteKey, { title: string; subtitle: string }> = {
  home: { title: "خانه", subtitle: "داشبورد مراقب" },
  profile: { title: "پروفایل", subtitle: "اطلاعات هویتی و حرفه‌ای" },
  wallet: { title: "اعتبار", subtitle: "کیف پول، تسویه و تسهیلات" },
  training: { title: "آموزش", subtitle: "آموزش‌های تخصیص‌یافته" },
  scorecard: { title: "کارنامه کاری", subtitle: "ارزیابی و امتیاز حرفه‌ای" },
  contract: { title: "قرارداد", subtitle: "پرونده فعال و وضعیت همکاری" },
  shifts: { title: "شیفت‌ها", subtitle: "برنامه و وضعیت خدمت" },
  support: { title: "پشتیبانی", subtitle: "ارتباط مستقیم با سلامت اول" },
  benefits: { title: "مزایا", subtitle: "مزایای عضویت و سابقه همکاری" },
};

const fa = (value: unknown) => Number(value || 0).toLocaleString("fa-IR");
const money = (value: unknown) => `${fa(value)} تومان`;
const text = (value: unknown, fallback = "—") => String(value ?? "").trim() || fallback;
const list = (value: unknown) => Array.isArray(value) ? value.map(String) : String(value || "").split(/[,،\n]/).map(v => v.trim()).filter(Boolean);
const percent = (value: unknown) => Math.max(0, Math.min(100, Number(value || 0)));
const dateFa = (value: unknown) => {
  if (!value) return "—";
  try { return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" }).format(new Date(String(value))); }
  catch { return String(value); }
};
const dateTimeFa = (value: unknown) => {
  if (!value) return "—";
  try { return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(value))); }
  catch { return String(value); }
};
const statusLabel = (value: unknown) => ({
  ACTIVE: "فعال", INACTIVE: "غیرفعال", APPROVED: "تأییدشده", PENDING: "در انتظار",
  REQUESTED: "در انتظار بررسی", UNDER_REVIEW: "در حال بررسی", REJECTED: "ردشده",
  PAID: "پرداخت‌شده", COMPLETED: "تکمیل‌شده", IN_PROGRESS: "در حال انجام",
  ASSIGNED: "تخصیص‌یافته", OPEN: "باز", RESOLVED: "حل‌شده", CLOSED: "بسته",
  FINAL: "نهایی", DRAFT: "پیش‌نویس", ISSUED: "صادرشده",
}[String(value || "").toUpperCase()] || text(value));

async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (typeof options.body === "string" && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options, headers });
  const raw = await response.text();
  let payload: any = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { detail: raw }; }
  if (!response.ok) {
    const error = new Error(payload.message || `خطای ${response.status}`) as ApiError;
    error.status = response.status; error.code = payload.error; error.detail = payload.detail;
    throw error;
  }
  return payload as T;
}

function initials(name: string) {
  return text(name, "مراقب").split(/\s+/).filter(Boolean).map(p => p[0]).join("").slice(0, 2) || "م";
}

function routeFromLocation(): RouteKey {
  const segment = location.pathname.replace(/^\/mobile\/?/, "").split("/")[0] || "home";
  return Object.prototype.hasOwnProperty.call(ROUTES, segment) ? segment as RouteKey : "home";
}

function routePath(route: RouteKey) { return route === "home" ? "/mobile/" : `/mobile/${route}`; }

function useRoute() {
  const [route, setRoute] = useState<RouteKey>(() => routeFromLocation());
  useEffect(() => {
    const onPop = () => setRoute(routeFromLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = (next: RouteKey) => {
    if (next === route) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    history.pushState({ route: next }, "", routePath(next));
    setRoute(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  return { route, navigate };
}

function Loading({ label = "در حال دریافت اطلاعات..." }: { label?: string }) {
  return <div className="mr-state"><span className="mr-spinner" /><strong>{label}</strong></div>;
}
function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="mr-state mr-error"><strong>دریافت اطلاعات انجام نشد</strong><small>{message}</small>{retry && <button className="mr-btn mr-primary" onClick={retry}><RefreshCw size={16}/>تلاش مجدد</button>}</div>;
}
function Empty({ title, description }: { title: string; description: string }) {
  return <div className="mr-state"><strong>{title}</strong><small>{description}</small></div>;
}
function Card({ children, className = "" }: { children: ReactNode; className?: string }) { return <section className={`mr-card ${className}`}>{children}</section>; }
function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return <article className="mr-metric"><small>{label}</small><strong>{value}</strong>{hint && <span>{hint}</span>}</article>;
}
function PageHead({ title, subtitle, onBack }: { title: string; subtitle: string; onBack?: () => void }) {
  return <header className="mr-page-head">{onBack && <button className="mr-icon-btn" onClick={onBack} aria-label="بازگشت"><ChevronLeft size={22}/></button>}<div><h1>{title}</h1><p>{subtitle}</p></div></header>;
}

function Splash() {
  return <main className="mr-splash"><img src="/logo-salamat-aval.svg" alt="سلامت اول"/><div className="mr-splash-line"/><h1>باشگاه مراقبین سلامت اول</h1><p>سامانه حرفه‌ای مراقبین</p></main>;
}

function Login({ onAuthenticated, notify }: { onAuthenticated: (user: any) => void; notify: Notify }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!identifier.trim() || !password) return notify("نام کاربری و رمز عبور را وارد کنید.", "error");
    setBusy(true);
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ identifier: identifier.trim().toLowerCase(), password }) });
      const me: any = await api("/api/auth/me");
      if (String(me?.data?.role || "").toUpperCase() !== "CAREGIVER") {
        location.replace("/panel?classic=1");
        return;
      }
      onAuthenticated(me.data);
    } catch (error: any) { notify(error?.message || "ورود انجام نشد.", "error"); }
    finally { setBusy(false); }
  };
  return <main className="mr-login">
    <section className="mr-login-video">
      <video src="/media/caregiver-club-intro.mp4" autoPlay muted loop playsInline preload="metadata" />
      <div className="mr-video-shade"/>
      <div className="mr-login-brand"><img src="/logo-salamat-aval.svg" alt="سلامت اول"/><span>باشگاه مراقبین</span></div>
    </section>
    <section className="mr-login-sheet">
      <span className="mr-eyebrow">شبکه حرفه‌ای سلامت اول</span>
      <h1>خوش آمدید</h1>
      <p>برای ورود به پنل مراقب، نام کاربری و رمز عبور خود را وارد کنید.</p>
      <form onSubmit={submit} noValidate>
        <label><span>نام کاربری</span><input value={identifier} onChange={e=>setIdentifier(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" inputMode="text" placeholder="نام کاربری یا ایمیل" /></label>
        <label><span>رمز عبور</span><input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" placeholder="رمز عبور" /></label>
        <button className="mr-login-submit" disabled={busy}>{busy ? <span className="mr-spinner small"/> : <ShieldCheck size={19}/>}<span>{busy ? "در حال ورود..." : "ورود به پنل"}</span></button>
      </form>
      <button className="mr-join" onClick={()=>location.assign("/?classic=1")}><Gift size={18}/><span>عضویت در شبکه مراقبین سلامت اول</span></button>
    </section>
  </main>;
}

function AppHeader({ user, profile, onMenu }: { user: any; profile?: any; onMenu: () => void }) {
  const name = profile?.fullName || user?.fullName || "مراقب سلامت اول";
  return <header className="mr-app-header">
    <button className="mr-menu-btn" onClick={onMenu} aria-label="منو"><Menu size={22}/></button>
    <div className="mr-header-brand"><img src="/logo-salamat-aval.svg" alt="سلامت اول"/><div><strong>باشگاه مراقبین</strong><small>سلامت اول</small></div></div>
    <div className="mr-avatar">{profile?.avatarUrl ? <img src={`${profile.avatarUrl}?v=${encodeURIComponent(profile.updatedAt || Date.now())}`} alt={name}/> : initials(name)}</div>
  </header>;
}

const modules: Array<{ route: RouteKey; label: string; sub: string; icon: React.ComponentType<any> }> = [
  { route: "scorecard", label: "کارنامه", sub: "امتیاز و رتبه", icon: ClipboardCheck },
  { route: "training", label: "آموزش", sub: "دوره‌های من", icon: BookOpen },
  { route: "contract", label: "قرارداد", sub: "همکاری فعال", icon: FileText },
  { route: "shifts", label: "شیفت‌ها", sub: "برنامه خدمت", icon: CalendarDays },
  { route: "profile", label: "پروفایل", sub: "اطلاعات من", icon: UserRound },
  { route: "support", label: "پشتیبانی", sub: "ارتباط با مرکز", icon: Headphones },
  { route: "wallet", label: "اعتبار", sub: "کیف پول و تسهیلات", icon: WalletCards },
  { route: "benefits", label: "مزایا", sub: "باشگاه مراقبین", icon: Sparkles },
];

function HomePage({ user, navigate, notify }: { user: any; navigate: (r: RouteKey) => void; notify: Notify }) {
  const [data, setData] = useState<any>(null); const [error, setError] = useState("");
  const load = async () => { setError(""); try { const p: any = await api("/api/caregiver/platform/dashboard"); setData(p.data); } catch (e: any) { setError(e.message); } };
  useEffect(()=>{ void load(); },[]);
  if (error) return <ErrorState message={error} retry={load}/>;
  if (!data) return <Loading label="در حال آماده‌سازی داشبورد شما..."/>;
  const c = data.caregiver || {}, contract = data.activeContract || {}, evaluation = data.latestEvaluation || {}, credit = data.credit || {};
  return <div className="mr-stack">
    <section className="mr-hero">
      <span className="mr-eyebrow light">باشگاه مراقبین سلامت اول</span>
      <h1>سلام {text(c.fullName || user?.fullName, "مراقب").split(/\s+/)[0]} 👋</h1>
      <p>وضعیت حرفه‌ای، آموزش، قرارداد و اعتبار شما در یک نگاه.</p>
      <div className="mr-hero-id"><small>شناسه حرفه‌ای</small><strong>{text(c.membershipCode || c.id)}</strong></div>
    </section>
    <section className="mr-metrics">
      <Metric label="امتیاز ارزیابی" value={evaluation.finalScore == null ? "—" : fa(evaluation.finalScore)} hint={evaluation.id ? statusLabel(evaluation.status) : "هنوز ارزیابی نهایی نشده"}/>
      <Metric label="قابل تسویه" value={money(data.wallet?.availableToman || 0)} hint="مانده کیف پول"/>
      <Metric label="آموزش تکمیل‌شده" value={`${fa(data.training?.completed || 0)} / ${fa(data.training?.assigned || 0)}`} hint="دوره‌های تخصیص‌یافته"/>
      <Metric label="قرارداد فعال" value={text(contract.contractNumber)} hint={text(contract.familyName, "قرارداد فعالی ثبت نشده")}/>
    </section>
    <div className="mr-section-title"><div><h2>خدمات من</h2><p>برای ورود روی هر آیکون بزنید</p></div></div>
    <section className="mr-module-grid">{modules.map(item => { const Icon = item.icon; return <button key={item.route} className="mr-module" onClick={()=>navigate(item.route)}><span className="mr-module-icon"><Icon size={24}/></span><strong>{item.label}</strong><small>{item.sub}</small></button>; })}</section>
    <Card className="mr-credit-card"><div className="mr-card-head"><div><h3>اعتبار بلندمدت</h3><p>سابقه همکاری شما برای تسهیلات</p></div><span className="mr-pill">{credit.eligible ? "واجد شرایط" : `${fa(credit.progressPercent || 0)}٪`}</span></div><div className="mr-progress"><i style={{width:`${percent(credit.progressPercent)}%`}}/></div><button className="mr-link-btn" onClick={()=>navigate("wallet")}>مشاهده جزئیات <ChevronLeft size={16}/></button></Card>
  </div>;
}

function ProfilePage({ user, notify, onProfile }: { user: any; notify: Notify; onProfile: (p: any)=>void }) {
  const [profile, setProfile] = useState<any>(null); const [error, setError] = useState(""); const [saving, setSaving] = useState(false); const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = async () => { setError(""); try { const p: any = await api("/api/caregiver/platform/profile"); setProfile(p.data); onProfile(p.data); } catch(e:any){ setError(e.message); } };
  useEffect(()=>{ void load(); },[]);
  if (error) return <ErrorState message={error} retry={load}/>;
  if (!profile) return <Loading label="در حال دریافت پروفایل..."/>;
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
    setSaving(true);
    try {
      const raw = Object.fromEntries(new FormData(form).entries()) as any;
      const payload = {
        firstName:text(raw.firstName,""),lastName:text(raw.lastName,""),fullName:text(raw.fullName,""),fatherName:text(raw.fatherName,""),
        nationalId:text(raw.nationalId,""),mobile:text(raw.mobile,""),landline:text(raw.landline,""),gender:text(raw.gender,""),birthDate:text(raw.birthDate,""),
        age:text(raw.age,""),ageGroup:text(raw.ageGroup,""),dialect:text(raw.dialect,""),homeRegion:text(raw.homeRegion,""),activityRegion:text(raw.activityRegion,""),
        primaryType:text(raw.primaryType,""),specialties:list(raw.specialties),acceptedShifts:list(raw.acceptedShifts),motherAssistant:text(raw.motherAssistant,""),
        employed:text(raw.employed,""),workHistory:text(raw.workHistory,""),username:text(raw.username,""),password:text(raw.password,""),
      };
      const result:any = await api("/api/caregiver/platform/profile",{method:"PATCH",body:JSON.stringify(payload)}); setProfile(result.data); onProfile(result.data); notify("پروفایل با موفقیت ذخیره شد.","success");
    } catch(e:any){ notify(e.message,"error"); } finally { setSaving(false); }
  };
  const upload = async () => {
    const file = fileRef.current?.files?.[0]; if (!file) return notify("ابتدا تصویر را انتخاب کنید.","error");
    setUploading(true);
    try { const result:any = await api("/api/caregiver/platform/profile/avatar",{method:"POST",headers:{"content-type":file.type,"x-file-size":String(file.size)},body:file}); const next={...profile,avatarId:result.data?.id,avatarUrl:result.data?.url,updatedAt:result.data?.updatedAt}; setProfile(next); onProfile(next); notify("تصویر پروفایل به‌روزرسانی شد.","success"); }
    catch(e:any){ notify(e.message,"error"); } finally { setUploading(false); }
  };
  return <form className="mr-stack" onSubmit={save}>
    <Card className="mr-profile-hero"><div className="mr-avatar large">{profile.avatarUrl ? <img src={`${profile.avatarUrl}?v=${encodeURIComponent(profile.updatedAt || Date.now())}`} alt={profile.fullName}/> : initials(profile.fullName || user?.fullName)}</div><div><h2>{text(profile.fullName || user?.fullName)}</h2><p>{text(profile.primaryType,"مراقب سلامت اول")}</p><div className="mr-status-row"><span>{statusLabel(profile.accountStatus)}</span><span>{statusLabel(profile.fileStatus)}</span></div></div></Card>
    <Card><div className="mr-card-head"><div><h3>تصویر پروفایل</h3><p>تصویر واحد در پنل مراقب و مدیر</p></div></div><div className="mr-upload-row"><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"/><button type="button" className="mr-btn" onClick={upload} disabled={uploading}><Upload size={16}/>{uploading?"در حال بارگذاری...":"بارگذاری"}</button></div></Card>
    <Card><div className="mr-card-head"><div><h3>اطلاعات حساب</h3><p>نام کاربری و رمز ورود</p></div></div><div className="mr-form-grid"><label><span>نام کاربری</span><input name="username" defaultValue={profile.username||""} required autoComplete="username"/></label><label><span>رمز جدید</span><input name="password" type="password" minLength={8} autoComplete="new-password" placeholder="در صورت نیاز به تغییر"/></label></div></Card>
    <Card><div className="mr-card-head"><div><h3>اطلاعات هویتی و تماس</h3></div></div><div className="mr-form-grid">
      <label><span>نام</span><input name="firstName" defaultValue={profile.firstName||""} required/></label><label><span>نام خانوادگی</span><input name="lastName" defaultValue={profile.lastName||""} required/></label><label className="wide"><span>نام کامل</span><input name="fullName" defaultValue={profile.fullName||""} required/></label>
      <label><span>نام پدر</span><input name="fatherName" defaultValue={profile.fatherName||""}/></label><label><span>کد ملی</span><input name="nationalId" defaultValue={profile.nationalId||""} inputMode="numeric" maxLength={10} required/></label><label><span>شماره همراه</span><input name="mobile" defaultValue={profile.mobile||""} inputMode="tel" maxLength={11} required/></label><label><span>تلفن ثابت</span><input name="landline" defaultValue={profile.landline||""}/></label>
      <label><span>جنسیت</span><select name="gender" defaultValue={profile.gender||""}><option value="">انتخاب نشده</option><option value="زن">زن</option><option value="مرد">مرد</option><option value="سایر">سایر</option></select></label><label><span>تاریخ تولد</span><input name="birthDate" defaultValue={profile.birthDate||""} placeholder="۱۳۷۰/۰۱/۰۱"/></label><label><span>سن</span><input name="age" type="number" min={18} max={100} defaultValue={profile.age||""}/></label><label><span>گروه سنی</span><input name="ageGroup" defaultValue={profile.ageGroup||""}/></label><label><span>لهجه</span><input name="dialect" defaultValue={profile.dialect||""}/></label>
    </div></Card>
    <Card><div className="mr-card-head"><div><h3>تخصص و همکاری</h3></div></div><div className="mr-form-grid"><label><span>محدوده سکونت</span><input name="homeRegion" defaultValue={profile.homeRegion||""} required/></label><label><span>محدوده فعالیت</span><input name="activityRegion" defaultValue={profile.activityRegion||""} required/></label><label><span>تخصص اصلی</span><input name="primaryType" defaultValue={profile.primaryType||""} required/></label><label className="wide"><span>تمام تخصص‌ها</span><input name="specialties" defaultValue={list(profile.specialties).join("، ")}/></label><label className="wide"><span>شیفت‌های پذیرفته‌شده</span><input name="acceptedShifts" defaultValue={list(profile.acceptedShifts||profile.shiftServices).join("، ")}/></label><label><span>کمک مادر</span><input name="motherAssistant" defaultValue={profile.motherAssistant||""}/></label><label><span>وضعیت اشتغال</span><input name="employed" defaultValue={profile.employed||""}/></label><label className="wide"><span>سوابق کاری</span><textarea name="workHistory" defaultValue={profile.workHistory||""}/></label></div></Card>
    <button className="mr-save" disabled={saving}>{saving?<span className="mr-spinner small"/>:<Save size={18}/>}<span>{saving?"در حال ذخیره...":"ذخیره تغییرات"}</span></button>
  </form>;
}

function WalletPage({ notify }: { notify: Notify }) {
  const [data,setData]=useState<any>(null),[error,setError]=useState(""),[modal,setModal]=useState<"settlement"|"credit"|null>(null),[busy,setBusy]=useState(false);
  const load=async()=>{setError("");try{const p:any=await api("/api/caregiver/platform/wallet");setData(p.data)}catch(e:any){setError(e.message)}};
  useEffect(()=>{void load()},[]);
  if(error)return <ErrorState message={error} retry={load}/>; if(!data)return <Loading label="در حال دریافت اعتبار و کیف پول..."/>;
  const s=data.summary||{},credit=data.benefits?.credit||{},transactions=data.transactions||[],settlements=data.settlements||[],credits=data.creditRequests||[];
  const submitSettlement=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();setBusy(true);try{await api("/api/caregiver/platform/settlements",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget).entries()))});notify("درخواست تسویه ثبت شد.","success");setModal(null);await load()}catch(x:any){notify(x.message,"error")}finally{setBusy(false)}};
  const submitCredit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();setBusy(true);try{await api("/api/caregiver/platform/credit-requests",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget).entries()))});notify("درخواست اعتبار ثبت شد.","success");setModal(null);await load()}catch(x:any){notify(x.message,"error")}finally{setBusy(false)}};
  return <div className="mr-stack">
    <section className="mr-metrics"><Metric label="مانده کیف پول" value={money(s.balanceToman)}/><Metric label="قابل تسویه" value={money(s.availableToman)}/><Metric label="در انتظار تسویه" value={money(s.pendingSettlementToman)}/><Metric label="اعتبار بلندمدت" value={credit.eligible?"واجد شرایط":`${fa(credit.progressPercent)}٪`}/></section>
    <Card><div className="mr-card-head"><div><h3>عملیات مالی</h3><p>درخواست‌های شما مستقیماً در سامانه ثبت می‌شود</p></div></div><div className="mr-actions"><button className="mr-btn mr-primary" disabled={Number(s.availableToman||0)<=0} onClick={()=>setModal("settlement")}>تقاضای تسویه</button><button className="mr-btn" disabled={!credit.eligible || credits.some((x:any)=>["REQUESTED","UNDER_REVIEW","APPROVED"].includes(x.status))} onClick={()=>setModal("credit")}>تقاضای اعتبار</button></div><div className="mr-progress"><i style={{width:`${percent(credit.progressPercent)}%`}}/></div><small className="mr-help">پیشرفت سابقه همکاری: {fa(credit.progressPercent||0)}٪</small></Card>
    <Card><div className="mr-card-head"><div><h3>تراکنش‌ها</h3></div></div><div className="mr-list">{transactions.length?transactions.map((item:any)=><article className="mr-row" key={item.id}><div><strong>{text(item.title)}</strong><small>{text(item.description||item.referenceId," ")} • {dateFa(item.createdAt)}</small></div><b className={item.direction==="DEBIT"?"debit":"credit"}>{item.direction==="DEBIT"?"−":"+"} {money(item.amountToman)}</b></article>):<Empty title="تراکنشی ثبت نشده" description="پاداش‌ها و تسویه‌ها پس از ثبت در این قسمت نمایش داده می‌شوند."/>}</div></Card>
    <Card><div className="mr-card-head"><div><h3>درخواست‌های من</h3></div></div><div className="mr-list">{[...settlements,...credits].length?[...settlements.map((x:any)=>({...x,_type:"تسویه"})),...credits.map((x:any)=>({...x,_type:"اعتبار"}))].map((item:any)=><article className="mr-row" key={`${item._type}-${item.id}`}><div><strong>{item._type} • {money(item.amountToman||item.requestedAmountToman)}</strong><small>{dateFa(item.createdAt)}</small></div><span className="mr-pill">{statusLabel(item.status)}</span></article>):<Empty title="درخواستی ندارید" description="درخواست‌های تسویه و اعتبار اینجا پیگیری می‌شوند."/>}</div></Card>
    {modal&&<div className="mr-modal-backdrop"><section className="mr-modal"><button className="mr-modal-close" onClick={()=>setModal(null)}><X size={20}/></button>{modal==="settlement"?<form onSubmit={submitSettlement}><h2>تقاضای تسویه</h2><p>مانده قابل تسویه: <b>{money(s.availableToman)}</b></p><label><span>مبلغ (تومان)</span><input name="amountToman" type="number" min={1} max={Number(s.availableToman||0)} defaultValue={s.availableToman||0} required/></label><label><span>نام صاحب حساب</span><input name="accountHolderName" required/></label><label><span>شماره شبا</span><input name="iban" dir="ltr" placeholder="IR..."/></label><label><span>شماره حساب</span><input name="accountNumber" dir="ltr"/></label><label><span>بانک</span><input name="bankName"/></label><label><span>توضیح</span><textarea name="note"/></label><button className="mr-save" disabled={busy}>ثبت درخواست</button></form>:<form onSubmit={submitCredit}><h2>درخواست اعتبار</h2><p>شرایط سابقه همکاری شما برای ارسال درخواست فعال است.</p><label><span>توضیحات</span><textarea name="note" placeholder="توضیحات تکمیلی"/></label><button className="mr-save" disabled={busy}>ارسال درخواست</button></form>}</section></div>}
  </div>;
}

function TrainingPage({ notify }: { notify: Notify }) {
  const [data,setData]=useState<any>(null),[error,setError]=useState(""),[course,setCourse]=useState<any>(null),[session,setSession]=useState<any>(null),[viewed,setViewed]=useState(0);
  const timer=useRef<number|undefined>(undefined);
  const closeSession=async()=>{if(timer.current)window.clearInterval(timer.current);timer.current=undefined;const id=session?.id;setSession(null);if(id)try{await api(`/api/training/sessions/${encodeURIComponent(id)}/close`,{method:"POST",body:"{}"})}catch{}};
  const load=async()=>{setError("");await closeSession();setCourse(null);try{const p:any=await api("/api/training/my");setData(p.data)}catch(e:any){setError(e.message)}};
  useEffect(()=>{void load();return()=>{if(timer.current)window.clearInterval(timer.current)}},[]);
  useEffect(()=>{const onHide=()=>{if(session?.id)navigator.sendBeacon?.(`/api/training/sessions/${encodeURIComponent(session.id)}/close`,new Blob(["{}"],{type:"application/json"}))};window.addEventListener("pagehide",onHide);return()=>window.removeEventListener("pagehide",onHide)},[session]);
  if(error)return <ErrorState message={error} retry={load}/>; if(!data)return <Loading label="در حال دریافت آموزش‌های شما..."/>;
  const assignments=data.assignments||[],summary=data.summary||{};
  const openCourse=async(item:any)=>{try{await closeSession();const key=crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;const p:any=await api(`/api/training/enrollments/${encodeURIComponent(item.enrollmentId)}/open`,{method:"POST",body:JSON.stringify({clientSessionKey:key})});const id=p.data?.sessionId;if(!id)throw new Error("نشست آموزش ایجاد نشد.");setCourse(item);setSession({id});setViewed(Number(item.totalViewSeconds||0));timer.current=window.setInterval(async()=>{if(document.visibilityState!=="visible"||!document.hasFocus())return;try{const r:any=await api(`/api/training/sessions/${encodeURIComponent(id)}/heartbeat`,{method:"POST",body:"{}"});setViewed(Number(item.totalViewSeconds||0)+Number(r.data?.durationSeconds||0))}catch{}},15000)}catch(e:any){notify(e.message,"error")}};
  const complete=async()=>{if(!course)return;try{await api(`/api/training/enrollments/${encodeURIComponent(course.enrollmentId)}/complete`,{method:"POST",body:"{}"});notify("آموزش تکمیل شد و در پرونده ثبت شد.","success");await load()}catch(e:any){notify(e.message,"error")}};
  if(course){const url=String(course.contentUrl||"");const ext=(()=>{try{return new URL(url,location.origin).pathname.toLowerCase()}catch{return""}})();return <div className="mr-stack"><button className="mr-back-inline" onClick={load}><ChevronLeft size={18}/>بازگشت به آموزش‌ها</button><Card><div className="mr-card-head"><div><h3>{text(course.title)}</h3><p>{text(course.description," ")}</p></div><span className="mr-pill">{Math.floor(viewed/60).toLocaleString("fa-IR")} دقیقه مشاهده</span></div><div className="mr-course-viewer">{/\.(mp4|webm|mov)$/.test(ext)?<video controls playsInline preload="metadata" src={url}/>: /\.(mp3|m4a|wav|ogg)$/.test(ext)?<audio controls src={url}/>:url?<iframe title={course.title||"آموزش"} src={url}/>:<Empty title="محتوا آماده نیست" description="برای این آموزش هنوز فایل یا لینک محتوا ثبت نشده است."/>}</div><button className="mr-save" onClick={complete}><BadgeCheck size={18}/>تأیید تکمیل آموزش</button></Card></div>}
  return <div className="mr-stack"><section className="mr-metrics"><Metric label="کل آموزش‌ها" value={fa(summary.assigned||assignments.length)}/><Metric label="بازشده" value={fa(summary.opened||0)}/><Metric label="تکمیل‌شده" value={fa(summary.completed||0)}/><Metric label="زمان مشاهده" value={`${fa(Math.floor(Number(summary.totalViewSeconds||0)/60))} دقیقه`}/></section><div className="mr-course-grid">{assignments.length?assignments.map((item:any)=><Card key={item.enrollmentId} className="mr-course-card"><div className="mr-card-head"><div><span className="mr-pill">{text(item.category,"آموزش سازمانی")}</span><h3>{text(item.title)}</h3></div><span className="mr-pill subtle">{statusLabel(item.status)}</span></div><p>{text(item.description,"توضیحی ثبت نشده است.")}</p><div className="mr-course-meta"><span>{fa(item.durationMinutes||0)} دقیقه</span><span>{fa(item.openCount||0)} بار مشاهده</span></div><div className="mr-progress"><i style={{width:`${percent(item.progress)}%`}}/></div><button className="mr-btn mr-primary" onClick={()=>openCourse(item)}>مشاهده آموزش</button></Card>):<Empty title="آموزشی تخصیص داده نشده" description="پس از تخصیص توسط واحد آموزش، دوره‌ها در همین بخش نمایش داده می‌شوند."/>}</div></div>;
}

function SupportPage({ user, notify }: { user: any; notify: Notify }) {
  const [threads,setThreads]=useState<any[]>([]),[active,setActive]=useState<string>(""),[messages,setMessages]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[newThread,setNewThread]=useState(false);
  const loadThreads=async()=>{setLoading(true);setError("");try{const p:any=await api("/api/caregiver/platform/support/threads");const rows=p.data?.threads||[];setThreads(rows);const id=active||rows[0]?.id||"";setActive(id);if(id){const m:any=await api(`/api/caregiver/platform/support/threads/${encodeURIComponent(id)}/messages`);setMessages(m.data?.messages||[])}else setMessages([])}catch(e:any){setError(e.message)}finally{setLoading(false)}};
  useEffect(()=>{void loadThreads()},[]);
  const open=async(id:string)=>{setActive(id);try{const p:any=await api(`/api/caregiver/platform/support/threads/${encodeURIComponent(id)}/messages`);setMessages(p.data?.messages||[])}catch(e:any){notify(e.message,"error")}};
  const send=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!active)return;const form=e.currentTarget,raw=Object.fromEntries(new FormData(form).entries()) as any,msg=String(raw.text||"").trim();if(!msg)return;try{await api(`/api/caregiver/platform/support/threads/${encodeURIComponent(active)}/messages`,{method:"POST",body:JSON.stringify({text:msg})});form.reset();await open(active)}catch(x:any){notify(x.message,"error")}};
  const create=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const raw=Object.fromEntries(new FormData(e.currentTarget).entries()) as any;try{const p:any=await api("/api/caregiver/platform/support/threads",{method:"POST",body:JSON.stringify({category:"CASE",subject:raw.subject,message:raw.message})});setNewThread(false);setActive(p.data?.id||"");notify("گفت‌وگوی پشتیبانی ایجاد شد.","success");await loadThreads()}catch(x:any){notify(x.message,"error")}};
  if(loading)return <Loading label="در حال اتصال به پشتیبانی..."/>; if(error)return <ErrorState message={error} retry={loadThreads}/>;
  const thread=threads.find(t=>t.id===active);
  return <div className="mr-stack"><section className="mr-support-actions"><button className="mr-support-action" onClick={()=>setNewThread(true)}><MessageCircle size={21}/><span><strong>پشتیبانی پرونده</strong><small>گفت‌وگو درباره قرارداد، خانواده و شرایط جاری پرونده</small></span></button><a className="mr-support-action urgent" href="tel:1527"><PhoneCall size={21}/><span><strong>تماس فوری</strong><small>تماس مستقیم با مرکز پاسخگویی ۱۵۲۷</small></span></a></section>
    <Card><div className="mr-card-head"><div><h3>گفت‌وگوهای من</h3></div></div><div className="mr-thread-strip">{threads.length?threads.map(t=><button key={t.id} className={t.id===active?"active":""} onClick={()=>open(t.id)}><strong>{text(t.subject)}</strong><small>{statusLabel(t.status)}</small></button>):<span className="mr-help">هنوز گفت‌وگویی ثبت نشده است.</span>}</div></Card>
    {thread?<Card className="mr-chat"><div className="mr-card-head"><div><h3>{text(thread.subject)}</h3><p>{statusLabel(thread.status)}</p></div></div><div className="mr-messages">{messages.length?messages.map(m=><div key={m.id} className={`mr-message ${m.senderUserId===user?.id?"mine":""}`}><p>{text(m.textContent,"پیام صوتی")}</p><small>{text(m.senderName,"کاربر")} • {dateTimeFa(m.createdAt)}</small></div>):<Empty title="پیامی وجود ندارد" description="اولین پیام را ارسال کنید."/>}</div><form className="mr-message-form" onSubmit={send}><input name="text" placeholder="پیام خود را بنویسید..." autoComplete="off"/><button><ChevronLeft size={20}/></button></form></Card>:<Empty title="گفت‌وگویی انتخاب نشده" description="از بخش بالا یک گفت‌وگو بسازید یا انتخاب کنید."/>}
    {newThread&&<div className="mr-modal-backdrop"><section className="mr-modal"><button className="mr-modal-close" onClick={()=>setNewThread(false)}><X size={20}/></button><form onSubmit={create}><h2>پشتیبانی پرونده</h2><label><span>موضوع</span><input name="subject" required placeholder="موضوع درخواست"/></label><label><span>پیام</span><textarea name="message" required placeholder="شرح درخواست"/></label><button className="mr-save">شروع گفت‌وگو</button></form></section></div>}
  </div>;
}

function DashboardDerivedPage({ kind }: { kind: "scorecard" | "contract" | "shifts" | "benefits" }) {
  const [data,setData]=useState<any>(null),[error,setError]=useState("");
  const load=async()=>{setError("");try{const p:any=await api("/api/caregiver/platform/dashboard");setData(p.data)}catch(e:any){setError(e.message)}};
  useEffect(()=>{void load()},[kind]);
  if(error)return <ErrorState message={error} retry={load}/>; if(!data)return <Loading/>;
  const contract=data.activeContract||{},evaluation=data.latestEvaluation||{},credit=data.credit||{},caregiver=data.caregiver||{};
  if(kind==="scorecard") return <div className="mr-stack"><Card className="mr-score"><span>آخرین امتیاز ارزیابی</span><strong>{evaluation.finalScore==null?"—":fa(evaluation.finalScore)}</strong><small>{statusLabel(evaluation.status)}</small></Card><section className="mr-metrics"><Metric label="وضعیت" value={statusLabel(evaluation.status)}/><Metric label="تاریخ ارزیابی" value={dateFa(evaluation.finalizedAt||evaluation.updatedAt||evaluation.createdAt)}/><Metric label="شناسه ارزیابی" value={text(evaluation.id)}/><Metric label="درجه حرفه‌ای" value={text(evaluation.grade||caregiver.grade||caregiver.rank)}/></section><Card><div className="mr-card-head"><div><h3>کارنامه حرفه‌ای</h3><p>این صفحه از همان داده ثبت‌شده در نظام ارزیابی خوانده می‌شود.</p></div></div>{evaluation.id?<div className="mr-note success"><BadgeCheck size={18}/>آخرین ارزیابی شما در پرونده ثبت شده است.</div>:<Empty title="کارنامه نهایی ثبت نشده" description="پس از انجام و نهایی‌شدن ارزیابی، نتیجه در این بخش نمایش داده می‌شود."/>}</Card></div>;
  if(kind==="contract") return <div className="mr-stack">{contract.id?<><Card className="mr-contract"><span className="mr-pill">قرارداد فعال</span><h2>{text(contract.contractNumber)}</h2><p>{text(contract.familyName,"پرونده فعال")}</p></Card><section className="mr-details"><div><span>خانواده / پرونده</span><strong>{text(contract.familyName)}</strong></div><div><span>شماره قرارداد</span><strong>{text(contract.contractNumber)}</strong></div><div><span>تاریخ شروع</span><strong>{dateFa(contract.startDate||contract.startedAt)}</strong></div><div><span>تاریخ پایان</span><strong>{dateFa(contract.endDate||contract.endedAt)}</strong></div><div><span>نوع خدمت</span><strong>{text(contract.serviceType||contract.serviceGroup||contract.serviceTitle)}</strong></div><div><span>وضعیت</span><strong>{statusLabel(contract.status)}</strong></div></section></>:<Empty title="قرارداد فعالی ثبت نشده" description="پس از ارجاع و ثبت قرارداد، اطلاعات همکاری فعال شما اینجا نمایش داده می‌شود."/>}</div>;
  if(kind==="shifts") return <div className="mr-stack"><Card><div className="mr-card-head"><div><h3>برنامه خدمت</h3><p>اطلاعات شیفت از قرارداد و پرونده فعال شما خوانده می‌شود.</p></div></div>{contract.id?<div className="mr-details compact"><div><span>شیفت / الگوی خدمت</span><strong>{text(contract.shiftType||contract.shift||contract.scheduleType||contract.serviceShift,"طبق قرارداد")}</strong></div><div><span>ساعات برنامه‌ریزی‌شده</span><strong>{contract.scheduledHours==null?"طبق قرارداد":`${fa(contract.scheduledHours)} ساعت`}</strong></div><div><span>تاریخ شروع</span><strong>{dateFa(contract.startDate||contract.startedAt)}</strong></div><div><span>وضعیت پرونده</span><strong>{statusLabel(contract.status)}</strong></div></div>:<Empty title="شیفت فعالی وجود ندارد" description="با فعال‌شدن پرونده خدمت، برنامه شما در این بخش نمایش داده می‌شود."/>}</Card></div>;
  return <div className="mr-stack"><section className="mr-benefit-hero"><Sparkles size={28}/><h2>مزایای عضویت در شبکه سلامت اول</h2><p>سابقه حرفه‌ای شما مبنای دسترسی به تسهیلات و مزایای باشگاه است.</p></section><section className="mr-benefits"><Card><Gift size={22}/><h3>پاداش معرفی</h3><p>پاداش‌های تأییدشده مستقیماً در کیف پول مراقب ثبت می‌شوند.</p></Card><Card><WalletCards size={22}/><h3>تسهیلات اعتباری</h3><p>پیشرفت فعلی سابقه شما برای اعتبار بلندمدت: <b>{fa(credit.progressPercent||0)}٪</b></p><div className="mr-progress"><i style={{width:`${percent(credit.progressPercent)}%`}}/></div></Card><Card><ShieldCheck size={22}/><h3>قرارداد رسمی</h3><p>قراردادها و سوابق همکاری در پرونده حرفه‌ای شما نگهداری می‌شوند.</p></Card><Card><BookOpen size={22}/><h3>شبکه حرفه‌ای و آموزش</h3><p>آموزش‌های تخصیص‌یافته و ارزیابی‌ها بخشی از مسیر رشد حرفه‌ای شما هستند.</p></Card></section></div>;
}

function SideSheet({ open, close, navigate, logout }: { open:boolean; close:()=>void; navigate:(r:RouteKey)=>void; logout:()=>void }) {
  if(!open)return null;
  return <div className="mr-side-backdrop" onClick={close}><aside className="mr-side" onClick={e=>e.stopPropagation()}><div className="mr-side-brand"><img src="/logo-salamat-aval.svg" alt="سلامت اول"/><div><strong>باشگاه مراقبین</strong><small>نسخه React موبایل</small></div></div>{modules.map(item=><button key={item.route} onClick={()=>{navigate(item.route);close()}}>{React.createElement(item.icon,{size:19})}<span>{item.label}</span><ChevronLeft size={16}/></button>)}<button className="danger" onClick={logout}><LogOut size={19}/><span>خروج از حساب</span></button></aside></div>;
}

function BottomNav({ route, navigate }: { route:RouteKey; navigate:(r:RouteKey)=>void }) {
  const items:[RouteKey,string,React.ComponentType<any>][]=[["profile","پروفایل",CircleUserRound],["wallet","اعتبار",WalletCards],["home","خانه",Home],["support","پشتیبانی",Headphones],["training","آموزش",BookOpen]];
  return <nav className="mr-bottom">{items.map(([key,label,Icon])=><button key={key} className={`${route===key?"active":""} ${key==="home"?"home":""}`} onClick={()=>navigate(key)}><span><Icon size={key==="home"?23:21}/></span><small>{label}</small></button>)}</nav>;
}

function MobileApp({ user, onLogout }: { user:any; onLogout:()=>void }) {
  const {route,navigate}=useRoute(); const [profile,setProfile]=useState<any>(null); const [menu,setMenu]=useState(false); const [notice,setNotice]=useState<{message:string;tone:string}|null>(null);
  const notify:Notify=(message,tone="info")=>{setNotice({message,tone});window.setTimeout(()=>setNotice(null),3200)};
  useEffect(()=>{api<any>("/api/caregiver/platform/profile").then(p=>setProfile(p.data)).catch(()=>undefined)},[]);
  const logout=async()=>{try{await api("/api/auth/logout",{method:"POST"})}catch{}onLogout()};
  const page=ROUTES[route];
  return <div className="mr-app"><AppHeader user={user} profile={profile} onMenu={()=>setMenu(true)}/><main className="mr-main"><PageHead title={page.title} subtitle={page.subtitle}/>{route==="home"&&<HomePage user={user} navigate={navigate} notify={notify}/>} {route==="profile"&&<ProfilePage user={user} notify={notify} onProfile={setProfile}/>} {route==="wallet"&&<WalletPage notify={notify}/>} {route==="training"&&<TrainingPage notify={notify}/>} {route==="support"&&<SupportPage user={user} notify={notify}/>} {route==="scorecard"&&<DashboardDerivedPage kind="scorecard"/>} {route==="contract"&&<DashboardDerivedPage kind="contract"/>} {route==="shifts"&&<DashboardDerivedPage kind="shifts"/>} {route==="benefits"&&<DashboardDerivedPage kind="benefits"/>}</main><BottomNav route={route} navigate={navigate}/><SideSheet open={menu} close={()=>setMenu(false)} navigate={navigate} logout={logout}/>{notice&&<div className={`mr-toast ${notice.tone}`}>{notice.tone==="success"?<BadgeCheck size={18}/>:notice.tone==="error"?<X size={18}/>:<Sparkles size={18}/>}<span>{notice.message}</span></div>}</div>;
}

function Root() {
  const [phase,setPhase]=useState<"splash"|"login"|"app"|"staff">("splash"),[user,setUser]=useState<any>(null),[notice,setNotice]=useState<{message:string;tone:string}|null>(null);
  const notify:Notify=(message,tone="info")=>{setNotice({message,tone});window.setTimeout(()=>setNotice(null),3200)};
  useEffect(()=>{let active=true;const started=Date.now();(async()=>{try{const me:any=await api("/api/auth/me");const wait=Math.max(0,700-(Date.now()-started));if(wait)await new Promise(r=>setTimeout(r,wait));if(!active)return;if(String(me?.data?.role||"").toUpperCase()!=="CAREGIVER"){setUser(me.data);setPhase("staff");return}setUser(me.data);setPhase("app")}catch(e:any){const wait=Math.max(0,700-(Date.now()-started));if(wait)await new Promise(r=>setTimeout(r,wait));if(active)setPhase("login")}})();return()=>{active=false}},[]);
  if(phase==="splash")return <Splash/>;
  if(phase==="staff")return <main className="mr-staff-bridge"><img src="/logo-salamat-aval.svg" alt="سلامت اول"/><h1>حساب سازمانی شناسایی شد</h1><p>این نسخه React برای پنل مراقب فعال شده است. پنل سازمانی فعلی بدون تغییر در دسترس است.</p><button onClick={()=>location.replace("/panel?classic=1")}>ورود به پنل سازمانی</button><button className="soft" onClick={async()=>{try{await api("/api/auth/logout",{method:"POST"})}catch{}setUser(null);setPhase("login")}}>خروج و ورود با حساب مراقب</button></main>;
  if(phase==="login")return <><Login notify={notify} onAuthenticated={u=>{setUser(u);history.replaceState({route:"home"},"","/mobile/");setPhase("app")}}/>{notice&&<div className={`mr-toast ${notice.tone}`}><span>{notice.message}</span></div>}</>;
  return <MobileApp user={user} onLogout={()=>{setUser(null);history.replaceState({},"","/mobile/");setPhase("login")}}/>;
}

const root=document.getElementById("mobile-react-root");
if(!root)throw new Error("mobile-react-root not found");
createRoot(root).render(<Root/>);
