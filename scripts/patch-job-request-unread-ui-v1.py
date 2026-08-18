from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str):
    p = Path(path)
    s = p.read_text()
    if new in s:
        return
    if old not in s:
        raise SystemExit(f"anchor not found: {label} in {path}")
    p.write_text(s.replace(old, new, 1))

# Wire unread API ahead of the existing job-ad list route.
replace_once(
    "worker/index-desktop-react-v1.ts",
    'import {routeStaffJobAdListFiltersV1} from "./staff-job-ad-list-filters-v1";\n',
    'import {routeStaffJobAdListFiltersV1} from "./staff-job-ad-list-filters-v1";\nimport {routeStaffJobRequestUnreadV1} from "./job-request-unread-v1";\n',
    "worker unread import",
)
replace_once(
    "worker/index-desktop-react-v1.ts",
    '    const staffJobAdListResponse=await routeStaffJobAdListFiltersV1(request,env);if(staffJobAdListResponse)return staffJobAdListResponse;',
    '    const staffJobRequestUnreadResponse=await routeStaffJobRequestUnreadV1(request,env);if(staffJobRequestUnreadResponse)return staffJobRequestUnreadResponse;\n    const staffJobAdListResponse=await routeStaffJobAdListFiltersV1(request,env);if(staffJobAdListResponse)return staffJobAdListResponse;',
    "worker unread route",
)

# Desktop sidebar/module indicators.
replace_once(
    "desktop-react/app.tsx",
    'import {JobAdsPage} from "./job-ads-v1";\n',
    'import {JobAdsPage} from "./job-ads-v1";\nimport {JobRequestUnreadDotV1} from "./job-request-unread-v1";\n',
    "desktop unread import",
)
replace_once(
    "desktop-react/app.tsx",
    '<Icon size={20}/><span><strong>{m.label}</strong><small>{m.description||m.key}</small></span><ChevronLeft size={15}/>',
    '<Icon size={20}/><span><strong>{m.label}</strong><small>{m.description||m.key}</small></span>{m.key==="staff.job_ads"&&<JobRequestUnreadDotV1 compact/>}<ChevronLeft size={15}/>',
    "desktop sidebar unread dot",
)
replace_once(
    "desktop-react/users-dashboard-v2.tsx",
    'import {JalaliDateFilter,tehranDateKey,tehranIsoRange} from "./jalali-date-filter-v1";\n',
    'import {JalaliDateFilter,tehranDateKey,tehranIsoRange} from "./jalali-date-filter-v1";\nimport {JobRequestUnreadDotV1} from "./job-request-unread-v1";\n',
    "desktop dashboard unread import",
)
replace_once(
    "desktop-react/users-dashboard-v2.tsx",
    '<button key={m.key} onClick={()=>navigate(m.key)}><span>{m.label?.slice(0,2)}</span><strong>{m.label}</strong><small>{m.description||m.key}</small></button>',
    '<button className="jru-module-wrap" key={m.key} onClick={()=>navigate(m.key)}><span>{m.label?.slice(0,2)}</span><strong>{m.label}</strong><small>{m.description||m.key}</small>{m.key==="staff.job_ads"&&<JobRequestUnreadDotV1 compact/>}</button>',
    "desktop dashboard module dot",
)

# Desktop bank: row indicator + clear only when that row is opened.
replace_once(
    "desktop-react/job-ads-v3.tsx",
    'import {JobAdApplicantRecordV1} from "./job-ad-applicant-record-v1";\n',
    'import {JobAdApplicantRecordV1} from "./job-ad-applicant-record-v1";\nimport {markJobAdRequestsSeenV1} from "./job-request-unread-v1";\n',
    "desktop job bank unread import",
)
replace_once(
    "desktop-react/job-ads-v3.tsx",
    ' useEffect(()=>{const edit=new URLSearchParams(location.search).get("edit");if(edit)setSelected(edit)},[]);useEffect(()=>{void load()},[statusFilter,sort,applicantRange]);\n const active=',
    ' useEffect(()=>{const edit=new URLSearchParams(location.search).get("edit");if(edit)setSelected(edit)},[]);useEffect(()=>{void load()},[statusFilter,sort,applicantRange]);\n const openAd=(id:string)=>{setSelected(id);setAds(rows=>rows.map(row=>String(row.id)===id?{...row,hasUnreadRequests:false,unreadRequestCount:0}:row));void markJobAdRequestsSeenV1(id).catch(()=>void load())};\n const active=',
    "desktop open specific ad marks seen",
)
replace_once(
    "desktop-react/job-ads-v3.tsx",
    '<tr key={ad.id} onClick={()=>setSelected(ad.id)}><td><strong>{ad.customerFullName}</strong></td>',
    '<tr key={ad.id} onClick={()=>openAd(String(ad.id))}><td><strong className="jru-row-title">{ad.hasUnreadRequests&&<span className="jru-row-dot" aria-label="درخواست جدید"/>}{ad.customerFullName}</strong></td>',
    "desktop row unread dot",
)

# Mobile admin home module dot.
replace_once(
    "mobile-react/admin.tsx",
    'import "./admin.css";\n',
    'import "./admin.css";\nimport {MobileJobRequestUnreadDotV1} from "./job-request-unread-v1";\n',
    "mobile admin unread import",
)
replace_once(
    "mobile-react/admin.tsx",
    '<button className="ma-module" key={module.key} onClick={()=>navigate(route)}><span><Icon size={25}/></span><strong>{module.label}</strong></button>',
    '<button className="ma-module" key={module.key} onClick={()=>navigate(route)}><span><Icon size={25}/></span><strong>{module.label}</strong>{module.key==="staff.job_ads"&&<MobileJobRequestUnreadDotV1/>}</button>',
    "mobile admin module dot",
)

# Current mobile manager bank row dot + seen-on-open.
replace_once(
    "mobile-react/admin-job-ads-v4.tsx",
    'import {AdminJobApplicantRecordV1} from "./admin-job-applicant-record-v1";\n',
    'import {AdminJobApplicantRecordV1} from "./admin-job-applicant-record-v1";\nimport {markMobileJobAdRequestsSeenV1} from "./job-request-unread-v1";\n',
    "mobile job bank unread import",
)
replace_once(
    "mobile-react/admin-job-ads-v4.tsx",
    ' const open=async(id:string,startEdit=false)=>{try{const p:any=await api(`/api/staff/job-ads/${encodeURIComponent(id)}`);setDetail(p.data);if(startEdit)setEdit(p.data?.ad)}catch(e:any){notify(e.message,"error")}};',
    ' const open=async(id:string,startEdit=false)=>{setAds(rows=>rows.map(row=>String(row.id)===id?{...row,hasUnreadRequests:false,unreadRequestCount:0}:row));void markMobileJobAdRequestsSeenV1(id).catch(()=>undefined);try{const p:any=await api(`/api/staff/job-ads/${encodeURIComponent(id)}`);setDetail(p.data);if(startEdit)setEdit(p.data?.ad)}catch(e:any){notify(e.message,"error")}};',
    "mobile open specific ad marks seen",
)
replace_once(
    "mobile-react/admin-job-ads-v4.tsx",
    '<button type="button" className="maj-ad-card" key={ad.id} onClick={()=>void open(ad.id)}><div className="maj-ad-head">',
    '<button type="button" className="maj-ad-card" key={ad.id} onClick={()=>void open(ad.id)}>{ad.hasUnreadRequests&&<span className="mjr-row-dot" aria-label="درخواست جدید"/>}<div className="maj-ad-head">',
    "mobile row unread dot",
)

# Canonical caregiver action wording: the action itself is always «درخواست برای شغل».
p = Path("mobile-react/caregiver-job-ads-v1.tsx")
s = p.read_text()
s = s.replace('"آماده اپلای"', '"آماده ثبت درخواست"')
s = s.replace('>اپلای و ارسال درخواست به مشاور پرونده</button>', '>درخواست برای شغل</button>')
p.write_text(s)

# Replace the old Persian loanword across active club source surfaces without touching internal API/schema identifiers.
roots = [Path("desktop-react"), Path("mobile-react"), Path("worker"), Path("preview"), Path("shared"), Path("scripts")]
for root in roots:
    for p in root.rglob("*"):
        if p.suffix.lower() not in {".ts", ".tsx", ".js", ".mjs", ".css", ".html"}:
            continue
        try:
            text = p.read_text()
        except UnicodeDecodeError:
            continue
        if "اپلای" not in text and "اپلی" not in text:
            continue
        text = text.replace("اپلای", "درخواست").replace("اپلی", "درخواست")
        # Natural Persian cleanup after the exhaustive replacement.
        refinements = {
            "مراقبین درخواست‌کرده": "مراقبین درخواست‌دهنده",
            "پس از درخواست مراقبین": "پس از ثبت درخواست مراقبین",
            "برای مراقبین قابل درخواست است": "برای مراقبین امکان ثبت درخواست برای شغل دارد",
            "برای مراقبین قابل درخواست نیست": "برای مراقبین امکان ثبت درخواست برای شغل ندارد",
            "قابل درخواست است": "امکان ثبت درخواست برای شغل دارد",
            "قابل درخواست نیست": "امکان ثبت درخواست برای شغل ندارد",
            "برای آن درخواست کنند": "برای آن درخواست برای شغل ثبت کنند",
            "امکان درخواست جدید ندارد": "امکان ثبت درخواست جدید برای شغل ندارد",
            "امکان درخواست ندارد": "امکان ثبت درخواست برای شغل ندارد",
            "امکان درخواست یا ورود": "امکان ثبت درخواست برای شغل یا ورود",
            "برای این آگهی درخواست نکرده است": "برای این آگهی درخواستی ثبت نکرده است",
            "آماده درخواست": "آماده ثبت درخواست",
            "فرصت‌های خدمت و درخواست برای پرونده‌ها": "فرصت‌های خدمت و درخواست برای شغل",
            "فرصت‌های خدمت و درخواست": "فرصت‌های خدمت و درخواست برای شغل",
        }
        for old, new in refinements.items():
            text = text.replace(old, new)
        p.write_text(text)

# Ensure the caregiver CTA remains the concise product term even after global normalization.
p = Path("mobile-react/caregiver-job-ads-v1.tsx")
s = p.read_text().replace('>درخواست و ارسال درخواست به مشاور پرونده</button>', '>درخواست برای شغل</button>')
p.write_text(s)
