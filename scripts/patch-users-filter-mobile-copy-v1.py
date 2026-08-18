from pathlib import Path

# Backend: /api/users can export every mobile matching the exact active filters as one comma-separated CSV.
p=Path('worker/users-access-unified-v2.ts')
s=p.read_text()
anchor='''  const where = `WHERE ${filters.join(" AND ")}`;\n  const cte = `WITH directory AS (\n'''
replacement='''  const where = `WHERE ${filters.join(" AND ")}`;\n  const cte = `WITH directory AS (\n'''
if anchor not in s:
    raise SystemExit('users backend cte anchor missing')
# Insert export after the CTE closes and before totalRow.
needle='''  const totalRow = await env.DB.prepare(`${cte} SELECT COUNT(*) AS total FROM directory ${where}`)\n'''
insert='''  if (url.searchParams.get("export") === "mobiles") {\n    const mobileRow = await env.DB.prepare(`${cte} SELECT COUNT(DISTINCT mobile) AS count,GROUP_CONCAT(DISTINCT mobile) AS mobilesCsv FROM directory ${where} AND TRIM(COALESCE(mobile,''))<>''`)\n      .bind(...args)\n      .first<{ count: number; mobilesCsv: string | null }>();\n    return json({\n      data: { mobilesCsv: String(mobileRow?.mobilesCsv || ""), count: Number(mobileRow?.count || 0) },\n      query: q,\n      filters: { status: statusFilter, role: roleFilter, registration: registrationFilter, createdFrom, createdTo, sort },\n    });\n  }\n\n'''
if insert not in s:
    if needle not in s:
        raise SystemExit('users backend total anchor missing')
    s=s.replace(needle,insert+needle,1)
p.write_text(s)

# Registration directory: honor account-status/date filters too and support the same all-results mobile export.
p=Path('worker/caregiver-reregistration-v1.ts')
s=p.read_text()
helper_anchor='''function normalizeDigits(value:unknown){return str(value).replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\\D/g,"")}\n'''
helper='''function normalizedIso(value:unknown){const raw=str(value);if(!raw)return"";const timestamp=Date.parse(raw);return Number.isFinite(timestamp)?new Date(timestamp).toISOString():""}\n'''
if helper not in s:
    if helper_anchor not in s:
        raise SystemExit('registration helper anchor missing')
    s=s.replace(helper_anchor,helper_anchor+helper,1)
old='''  const page=Math.max(1,Number(url.searchParams.get("page")||1)||1),pageSize=Math.min(50,Math.max(1,Number(url.searchParams.get("pageSize")||50)||50)),offset=(page-1)*pageSize,q=str(url.searchParams.get("q")).trim(),sort=String(url.searchParams.get("sort")||"NEWEST").toUpperCase()==="OLDEST"?"ASC":"DESC";\n  const qLike=`%${q}%`,whereQ=q?` AND (u.full_name LIKE ? OR u.mobile LIKE ? OR COALESCE(u.username,'') LIKE ? OR c.full_name LIKE ? OR c.mobile LIKE ? OR COALESCE(c.national_id,'') LIKE ? OR COALESCE(c.membership_code,'') LIKE ?)` : "";\n  const bindings:any[]=[kind];if(q)bindings.push(qLike,qLike,qLike,qLike,qLike,qLike,qLike);\n  const base=` FROM caregiver_registration_events e JOIN caregivers c ON c.id=e.caregiver_id JOIN users u ON u.caregiver_id=c.id AND upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED' WHERE e.registration_kind=? AND e.id=(SELECT e2.id FROM caregiver_registration_events e2 WHERE e2.caregiver_id=e.caregiver_id ORDER BY e2.registered_at DESC,e2.id DESC LIMIT 1)${whereQ}`;\n  const count=await env.DB.prepare(`SELECT COUNT(*) AS total${base}`).bind(...bindings).first<{total:number}>();\n'''
new='''  const page=Math.max(1,Number(url.searchParams.get("page")||1)||1),pageSize=Math.min(50,Math.max(1,Number(url.searchParams.get("pageSize")||50)||50)),offset=(page-1)*pageSize,q=str(url.searchParams.get("q")).trim(),sort=String(url.searchParams.get("sort")||"NEWEST").toUpperCase()==="OLDEST"?"ASC":"DESC",statusFilter=str(url.searchParams.get("status")).toUpperCase(),createdFrom=normalizedIso(url.searchParams.get("createdFrom")),createdTo=normalizedIso(url.searchParams.get("createdTo"));\n  const qLike=`%${q}%`,whereQ=q?` AND (u.full_name LIKE ? OR u.mobile LIKE ? OR COALESCE(u.username,'') LIKE ? OR c.full_name LIKE ? OR c.mobile LIKE ? OR COALESCE(c.national_id,'') LIKE ? OR COALESCE(c.membership_code,'') LIKE ?)` : "";\n  const bindings:any[]=[kind];if(q)bindings.push(qLike,qLike,qLike,qLike,qLike,qLike,qLike);\n  let whereExtra="";if(statusFilter){whereExtra+=" AND upper(COALESCE(u.status,''))=?";bindings.push(statusFilter)}if(createdFrom){whereExtra+=" AND COALESCE(c.created_at,u.created_at)>=?";bindings.push(createdFrom)}if(createdTo){whereExtra+=" AND COALESCE(c.created_at,u.created_at)<?";bindings.push(createdTo)}\n  const base=` FROM caregiver_registration_events e JOIN caregivers c ON c.id=e.caregiver_id JOIN users u ON u.caregiver_id=c.id AND upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED' WHERE e.registration_kind=? AND e.id=(SELECT e2.id FROM caregiver_registration_events e2 WHERE e2.caregiver_id=e.caregiver_id ORDER BY e2.registered_at DESC,e2.id DESC LIMIT 1)${whereQ}${whereExtra}`;\n  if(url.searchParams.get("export")==="mobiles"){const mobileRow=await env.DB.prepare(`SELECT COUNT(DISTINCT u.mobile) AS count,GROUP_CONCAT(DISTINCT u.mobile) AS mobilesCsv${base} AND TRIM(COALESCE(u.mobile,''))<>''`).bind(...bindings).first<{count:number;mobilesCsv:string|null}>();return securityHeaders(json({data:{mobilesCsv:String(mobileRow?.mobilesCsv||""),count:Number(mobileRow?.count||0)}}))}\n  const count=await env.DB.prepare(`SELECT COUNT(*) AS total${base}`).bind(...bindings).first<{total:number}>();\n'''
if new not in s:
    if old not in s:
        raise SystemExit('registration list anchor missing')
    s=s.replace(old,new,1)
p.write_text(s)

# Mobile Admin Users & Access.
p=Path('mobile-react/admin-users-access-v1.tsx')
s=p.read_text()
s=s.replace('import {ArrowRight,ArrowUpDown,Check,ChevronLeft,Search,SlidersHorizontal,Trash2,UserPlus} from "lucide-react";','import {ArrowRight,ArrowUpDown,Check,ChevronLeft,Phone,Search,SlidersHorizontal,Trash2,UserPlus} from "lucide-react";',1)
s=s.replace('type UserQueryOverrides={role?:string;createdFrom?:string;createdTo?:string;sort?:string;registration?:string};','type UserQueryOverrides={role?:string;status?:string;createdFrom?:string;createdTo?:string;sort?:string;registration?:string};',1)
helper_anchor='''function initialRegistration(){const value=String(new URLSearchParams(location.search).get("registration")||"").toUpperCase();return ["NEW","REREGISTRATION"].includes(value)?value:""}\n'''
clip_helper='''async function writeClipboard(value:string){if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return}const area=document.createElement("textarea");area.value=value;area.setAttribute("readonly","");area.style.position="fixed";area.style.opacity="0";document.body.appendChild(area);area.select();const ok=document.execCommand("copy");area.remove();if(!ok)throw new Error("کپی شماره‌های تماس انجام نشد.")}\n'''
if clip_helper not in s:
    if helper_anchor not in s: raise SystemExit('mobile helper anchor missing')
    s=s.replace(helper_anchor,helper_anchor+clip_helper,1)
old_state=''' const [rows,setRows]=useState<any[]>([]),[config,setConfig]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[query,setQuery]=useState(""),[role,setRole]=useState(""),[createdFrom,setCreatedFrom]=useState(""),[createdTo,setCreatedTo]=useState(""),[registration,setRegistration]=useState(initialRegistration),[filterOpen,setFilterOpen]=useState(false),[sort,setSort]=useState("NEWEST"),[total,setTotal]=useState(0),[selected,setSelected]=useState<any>(null),[creating,setCreating]=useState(false);\n'''
new_state=''' const [rows,setRows]=useState<any[]>([]),[config,setConfig]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[query,setQuery]=useState(""),[role,setRole]=useState(""),[accountStatus,setAccountStatus]=useState(""),[createdFrom,setCreatedFrom]=useState(""),[createdTo,setCreatedTo]=useState(""),[registration,setRegistration]=useState(initialRegistration),[filterOpen,setFilterOpen]=useState(false),[sort,setSort]=useState("NEWEST"),[total,setTotal]=useState(0),[selected,setSelected]=useState<any>(null),[creating,setCreating]=useState(false);\n'''
if new_state not in s:
    if old_state not in s: raise SystemExit('mobile state anchor missing')
    s=s.replace(old_state,new_state,1)
old_load=''' const load=async(overrides:UserQueryOverrides={})=>{setLoading(true);setError("");try{const activeRole=overrides.role??role,activeFrom=overrides.createdFrom??createdFrom,activeTo=overrides.createdTo??createdTo,activeSort=overrides.sort??sort,activeRegistration=overrides.registration??registration,{createdFrom:createdFromIso,createdTo:createdToIso}=rangeFor(activeFrom,activeTo),params=new URLSearchParams({page:"1",pageSize:activeRegistration?"50":"250",sort:activeSort});if(query)params.set("q",query);if(activeRole&&!activeRegistration)params.set("role",activeRole);if(createdFromIso)params.set("createdFrom",createdFromIso);if(createdToIso)params.set("createdTo",createdToIso);if(activeRegistration)params.set("kind",activeRegistration);const endpoint=activeRegistration?`/api/admin/caregiver-registrations?${params.toString()}`:`/api/users?${params.toString()}`;const [u,c]:any=await Promise.all([api(endpoint),api("/api/admin/access/config")]);const list=Array.isArray(u.data)?u.data:[];setRows(list);setTotal(Number(u.pagination?.total??list.length));setConfig(c.data)}catch(e:any){setError(e.message)}finally{setLoading(false)}};\n'''
new_load=''' const load=async(overrides:UserQueryOverrides={})=>{setLoading(true);setError("");try{const activeRole=overrides.role??role,activeStatus=overrides.status??accountStatus,activeFrom=overrides.createdFrom??createdFrom,activeTo=overrides.createdTo??createdTo,activeSort=overrides.sort??sort,activeRegistration=overrides.registration??registration,{createdFrom:createdFromIso,createdTo:createdToIso}=rangeFor(activeFrom,activeTo),params=new URLSearchParams({page:"1",pageSize:activeRegistration?"50":"250",sort:activeSort});if(query)params.set("q",query);if(activeRole&&!activeRegistration)params.set("role",activeRole);if(activeStatus)params.set("status",activeStatus);if(createdFromIso)params.set("createdFrom",createdFromIso);if(createdToIso)params.set("createdTo",createdToIso);if(activeRegistration)params.set("kind",activeRegistration);const endpoint=activeRegistration?`/api/admin/caregiver-registrations?${params.toString()}`:`/api/users?${params.toString()}`;const [u,c]:any=await Promise.all([api(endpoint),api("/api/admin/access/config")]);const list=Array.isArray(u.data)?u.data:[];setRows(list);setTotal(Number(u.pagination?.total??list.length));setConfig(c.data)}catch(e:any){setError(e.message)}finally{setLoading(false)}};\n'''
if new_load not in s:
    if old_load not in s: raise SystemExit('mobile load anchor missing')
    s=s.replace(old_load,new_load,1)
old_clear=''' const clearFilters=()=>{setRole("");setCreatedFrom("");setCreatedTo("");setRegistration("");setSelected(null);setCreating(false);setFilterOpen(false);const url=new URL(location.href);url.searchParams.delete("registration");history.replaceState({},"",url);void load({role:"",createdFrom:"",createdTo:"",registration:""})};\n'''
new_clear=''' const clearFilters=()=>{setRole("");setAccountStatus("");setCreatedFrom("");setCreatedTo("");setRegistration("");setSelected(null);setCreating(false);setFilterOpen(false);const url=new URL(location.href);url.searchParams.delete("registration");history.replaceState({},"",url);void load({role:"",status:"",createdFrom:"",createdTo:"",registration:""})};\n'''
if new_clear not in s:
    if old_clear not in s: raise SystemExit('mobile clear anchor missing')
    s=s.replace(old_clear,new_clear,1)
old_count=''' const activeFilterCount=[role,createdFrom,createdTo,registration].filter(Boolean).length;\n'''
new_count=''' const activeFilterCount=[role,accountStatus,createdFrom,createdTo,registration].filter(Boolean).length;\n const copyFilteredMobiles=async()=>{try{const {createdFrom:createdFromIso,createdTo:createdToIso}=rangeFor(createdFrom,createdTo),params=new URLSearchParams({page:"1",sort,export:"mobiles"});if(query)params.set("q",query);if(role&&!registration)params.set("role",role);if(accountStatus)params.set("status",accountStatus);if(createdFromIso)params.set("createdFrom",createdFromIso);if(createdToIso)params.set("createdTo",createdToIso);if(registration)params.set("kind",registration);const endpoint=registration?`/api/admin/caregiver-registrations?${params.toString()}`:`/api/users?${params.toString()}`,payload:any=await api(endpoint),csv=String(payload.data?.mobilesCsv||""),count=Number(payload.data?.count||0);if(!csv||!count){notify("در نتیجه فیلترشده شماره همراهی برای کپی وجود ندارد.","info");return}await writeClipboard(csv);notify(`${count.toLocaleString("fa-IR")} شماره تماس با جداکننده , کپی شد.`,"success")}catch(x:any){notify(x.message||"کپی شماره‌های تماس انجام نشد.","error")}};\n'''
if new_count not in s:
    if old_count not in s: raise SystemExit('mobile active count anchor missing')
    s=s.replace(old_count,new_count,1)
old_bar='''<button type="button" className={`mau-toolbtn ${activeFilterCount?"active":""}`} onClick={()=>setFilterOpen(v=>!v)}><SlidersHorizontal size={17}/><span><b>فیلتر</b><small>{activeFilterCount?`${activeFilterCount.toLocaleString("fa-IR")} فیلتر فعال`:"سمت، ثبت نام و تاریخ"}</small></span></button></div>{filterOpen&&<div className="mau-filter-panel"><label><span>سمت سازمانی</span>'''
new_bar='''<button type="button" className={`mau-toolbtn ${activeFilterCount?"active":""}`} onClick={()=>setFilterOpen(v=>!v)}><SlidersHorizontal size={17}/><span><b>فیلتر</b><small>{activeFilterCount?`${activeFilterCount.toLocaleString("fa-IR")} فیلتر فعال`:"سمت، وضعیت، ثبت نام و تاریخ"}</small></span></button><button type="button" className="mau-toolbtn mau-copy-phones" onClick={()=>void copyFilteredMobiles()} disabled={loading}><Phone size={17}/><span><b>شماره‌های تماس</b><small>کپی همه نتایج فیلترشده</small></span></button></div>{filterOpen&&<div className="mau-filter-panel"><label><span>سمت سازمانی</span>'''
if new_bar not in s:
    if old_bar not in s: raise SystemExit('mobile command bar anchor missing')
    s=s.replace(old_bar,new_bar,1)
role_label='''</select></label><label><span>نوع ثبت‌نام مراقب</span><select value={registration}'''
status_label='''</select></label><label><span>وضعیت حساب</span><select value={accountStatus} onChange={e=>setAccountStatus(e.target.value)}><option value="">همه وضعیت‌ها</option><option value="ACTIVE">فعال</option><option value="PENDING">در انتظار</option><option value="SUSPENDED">تعلیق</option><option value="INACTIVE">غیرفعال</option></select></label><label><span>نوع ثبت‌نام مراقب</span><select value={registration}'''
if status_label not in s:
    if role_label not in s: raise SystemExit('mobile status filter anchor missing')
    s=s.replace(role_label,status_label,1)
old_display='''<div className="mau-count"><strong>{total.toLocaleString("fa-IR")} کاربر</strong><small>برای مشاهده اطلاعات حساب و دسترسی‌ها روی هر سطر بزنید.</small></div>'''
new_display='''<div className={`mau-count ${activeFilterCount||query?"filtered":""}`}><strong>{total.toLocaleString("fa-IR")} {activeFilterCount||query?"نتیجه فیلترشده":"کاربر"}</strong><small>{activeFilterCount||query?"تعداد کل کاربران منطبق با جست‌وجو و فیلترهای فعلی":"برای مشاهده اطلاعات حساب و دسترسی‌ها روی هر سطر بزنید."}</small></div>'''
if new_display not in s:
    if old_display not in s: raise SystemExit('mobile count display anchor missing')
    s=s.replace(old_display,new_display,1)
p.write_text(s)

# Mobile styling: three compact actions + highlighted filtered-count strip.
p=Path('mobile-react/admin-users-access-v1.css')
s=p.read_text()
extra='''.mau-commandbar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.mau-commandbar .mau-toolbtn{min-width:0}.mau-copy-phones{border-color:#b9d9c6!important;background:#f1fbf5!important;color:#117943!important}.mau-count.filtered{padding:9px 11px;border:1px solid #cfe6d7;border-radius:13px;background:#f3fbf6;align-items:center}.mau-count.filtered strong{color:#0d7940;font-size:14px}.mau-count.filtered small{color:#557063}@media(max-width:370px){.mau-commandbar{grid-template-columns:1fr 1fr}.mau-copy-phones{grid-column:1/-1}}'''
if extra not in s:
    s += extra
p.write_text(s)

# Desktop parity: copy all filtered mobiles and make filtered total prominent near the filters.
p=Path('desktop-react/users-dashboard-v2.tsx')
s=p.read_text()
s=s.replace('import {BadgeCheck,CalendarDays,Search,ShieldCheck,UserPlus,UsersRound} from "lucide-react";','import {BadgeCheck,CalendarDays,Phone,Search,ShieldCheck,UserPlus,UsersRound} from "lucide-react";',1)
helper_anchor='''const pendingRegistrationQuery="registration=SELF_REGISTERED&status=PENDING";\n'''
clip='''async function writeClipboard(value:string){if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return}const area=document.createElement("textarea");area.value=value;area.setAttribute("readonly","");area.style.position="fixed";area.style.opacity="0";document.body.appendChild(area);area.select();const ok=document.execCommand("copy");area.remove();if(!ok)throw new Error("کپی شماره‌های تماس انجام نشد.")}\n'''
if clip not in s:
    if helper_anchor not in s: raise SystemExit('desktop helper anchor missing')
    s=s.replace(helper_anchor,helper_anchor+clip,1)
apply_anchor=''' const applyFilters=()=>void load(1,query,currentFilters());\n const pendingMode=registrationFilter==="SELF_REGISTERED"&&statusFilter==="PENDING";\n'''
apply_new=''' const applyFilters=()=>void load(1,query,currentFilters());\n const filtersActive=Boolean(query||statusFilter||registrationFilter||createdDate);\n const copyFilteredMobiles=async()=>{try{const filters=currentFilters(),params=new URLSearchParams({page:"1",export:"mobiles"});if(query)params.set("q",query);if(filters.status)params.set("status",filters.status);if(filters.registration)params.set("registration",filters.registration);const range=filters.createdDate?tehranIsoRange(filters.createdDate):null;if(range){params.set("createdFrom",range.from);params.set("createdTo",range.to)}const p:any=await api(`/api/users?${params}`),csv=String(p.data?.mobilesCsv||""),count=Number(p.data?.count||0);if(!csv||!count){notify("در نتیجه فیلترشده شماره همراهی برای کپی وجود ندارد.","info");return}await writeClipboard(csv);notify(`${fa(count)} شماره تماس با جداکننده , کپی شد.`,"success")}catch(x:any){notify(x.message||"کپی شماره‌های تماس انجام نشد.","error")}};\n const pendingMode=registrationFilter==="SELF_REGISTERED"&&statusFilter==="PENDING";\n'''
if apply_new not in s:
    if apply_anchor not in s: raise SystemExit('desktop apply anchor missing')
    s=s.replace(apply_anchor,apply_new,1)
button_anchor='''<button type="button" className="da-btn soft" onClick={applyFilters}>اعمال فیلتر</button><button type="button" className="da-filter-reset" onClick={resetFilters}>پاک‌کردن فیلترها</button></div>'''
button_new='''<button type="button" className="da-btn soft" onClick={applyFilters}>اعمال فیلتر</button><button type="button" className="da-btn soft" onClick={()=>void copyFilteredMobiles()}><Phone size={16}/>شماره‌های تماس</button><button type="button" className="da-filter-reset" onClick={resetFilters}>پاک‌کردن فیلترها</button></div>{!loading&&<div className="da-filter-context"><UsersRound size={17}/><strong>{fa(pagination.total??rows.length)} {filtersActive?"نتیجه فیلترشده":"کاربر در فهرست"}</strong></div>}'''
if button_new not in s:
    if button_anchor not in s: raise SystemExit('desktop filter buttons anchor missing')
    s=s.replace(button_anchor,button_new,1)
p.write_text(s)
