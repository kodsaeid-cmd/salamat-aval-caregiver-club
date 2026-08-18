from pathlib import Path

# 1) Wire backend route into the protected outer worker.
p = Path("worker/index-desktop-react-v1.ts")
s = p.read_text()
imp_anchor = 'import {routeStaffJobRequestUnreadV1} from "./job-request-unread-v1";\n'
imp = 'import {routeAdminCaregiverWorkforceSummaryV1} from "./admin-caregiver-workforce-summary-v1";\n'
if imp not in s:
    if imp_anchor not in s:
        raise SystemExit("worker import anchor not found")
    s = s.replace(imp_anchor, imp_anchor + imp, 1)
route_anchor = '    const credentialResponse=await routeCaregiverInitialCredentialsV1(request,env);if(credentialResponse)return reconcileReferralStage1AfterActivation(request,env,credentialResponse,ctx);\n'
route = '    const workforceSummaryResponse=await routeAdminCaregiverWorkforceSummaryV1(request,env);if(workforceSummaryResponse)return workforceSummaryResponse;\n'
if route not in s:
    if route_anchor not in s:
        raise SystemExit("worker route anchor not found")
    s = s.replace(route_anchor, route_anchor + route, 1)
p.write_text(s)

# 2) Desktop admin dashboard: add one composite card with four live caregiver lifecycle counts.
p = Path("desktop-react/users-dashboard-v2.tsx")
s = p.read_text()
state_old = ' const [stats,setStats]=useState<any>(null);const modules=(access?.modules||[]).filter((m:any)=>m.panel==="STAFF"&&m.actions?.view);const permissions=modules.reduce((n:number,m:any)=>n+Object.values(m.actions||{}).filter(Boolean).length,0);'
state_new = ' const [stats,setStats]=useState<any>(null),[workforce,setWorkforce]=useState<any>(null);const modules=(access?.modules||[]).filter((m:any)=>m.panel==="STAFF"&&m.actions?.view);const permissions=modules.reduce((n:number,m:any)=>n+Object.values(m.actions||{}).filter(Boolean).length,0);'
if state_new not in s:
    if state_old not in s:
        raise SystemExit("desktop dashboard state anchor not found")
    s = s.replace(state_old, state_new, 1)
load_anchor = ' useEffect(()=>{Promise.allSettled([api<any>("/api/users?page=1"),api<any>("/api/users?page=1&status=PENDING&registration=SELF_REGISTERED"),api<any>("/api/admin/directory?page=1&includeCounts=1"),api<any>("/api/contracts?page=1&pageSize=1"),api<any>("/api/staff/payroll?page=1"),api<any>("/api/caregiver/platform/support/threads")]).then(([u,r,c,k,p,s])=>setStats({users:u.status==="fulfilled"?(u.value.pagination?.total??u.value.data?.length??0):null,pendingRegistrations:r.status==="fulfilled"?(r.value.pagination?.total??r.value.data?.length??0):null,caregivers:c.status==="fulfilled"?(c.value.data?.counts?.caregiverProfiles??c.value.data?.pagination?.total??0):null,contracts:k.status==="fulfilled"?(k.value.data?.pagination?.total??k.value.pagination?.total??0):null,payroll:p.status==="fulfilled"?(p.value.data?.summary?.total??0):null,support:s.status==="fulfilled"?(s.value.data?.threads||[]).filter((x:any)=>["OPEN","PENDING"].includes(x.status)).length:null}))},[]);\n'
load_add = ' useEffect(()=>{api<any>("/api/admin/caregiver-workforce-summary").then(p=>setWorkforce(p.data||null)).catch(()=>setWorkforce(null))},[]);\n'
if load_add not in s:
    if load_anchor not in s:
        raise SystemExit("desktop dashboard load anchor not found")
    s = s.replace(load_anchor, load_anchor + load_add, 1)
render_anchor = '<Metric label="اختیارات فعال" value={fa(permissions)}/></section><Card><div className="da-card-head"><div><h2>ماژول‌های در دسترس</h2>'
render_new = '<Metric label="اختیارات فعال" value={fa(permissions)}/></section><Card><div className="da-card-head"><div><h2>وضعیت عملیاتی مراقبین</h2><p>نمای زنده از مسیر درخواست تا اعزام و قرارداد؛ هر مراقب در هر وضعیت فقط یک‌بار شمارش می‌شود.</p></div></div><section className="da-metrics"><Metric label="مراقب فعال" value={workforce?fa(workforce.activeCaregivers):"…"}/><Metric label="در وضعیت اعزام" value={workforce?fa(workforce.dispatchCaregivers):"…"}/><Metric label="در قرارداد" value={workforce?fa(workforce.inContractCaregivers):"…"}/><Metric label="متقاضی قرارداد" value={workforce?fa(workforce.contractApplicants):"…"}/></section></Card><Card><div className="da-card-head"><div><h2>ماژول‌های در دسترس</h2>'
if render_new not in s:
    if render_anchor not in s:
        raise SystemExit("desktop dashboard render anchor not found")
    s = s.replace(render_anchor, render_new, 1)
p.write_text(s)

# 3) Mobile admin dashboard: same live card, responsive two-column layout.
p = Path("mobile-react/admin.tsx")
s = p.read_text()
old = 'function AdminDashboard({access,navigate}:{access:any;navigate:(r:AdminRoute)=>void}){const modules=allowedModules(access).filter(m=>m.key!=="staff.dashboard");return <div className="ma-stack"><section className="ma-welcome"><div className="ma-welcome-avatar">{initials(access?.user?.fullName)}</div><div><small>باشگاه مراقبین سلامت اول</small><h1>سلام، {text(access?.user?.fullName,"کاربر")}</h1><p>{access?.user?.roleLabel||roleFa[String(access?.user?.role||"").toUpperCase()]||"کاربر سازمانی"}</p></div></section><section className="ma-module-grid">{modules.map(module=>{const route=keyToRoute[module.key],Icon=routeMeta[route].icon;return <button className="ma-module" key={module.key} onClick={()=>navigate(route)}><span><Icon size={25}/></span><strong>{module.label}</strong>{module.key==="staff.job_ads"&&<MobileJobRequestUnreadDotV1/>}</button>})}</section></div>}\n'
new = 'function AdminDashboard({access,navigate}:{access:any;navigate:(r:AdminRoute)=>void}){const modules=allowedModules(access).filter(m=>m.key!=="staff.dashboard"),[workforce,setWorkforce]=useState<any>(null);useEffect(()=>{api<any>("/api/admin/caregiver-workforce-summary").then(p=>setWorkforce(p.data||null)).catch(()=>setWorkforce(null))},[]);return <div className="ma-stack"><section className="ma-welcome"><div className="ma-welcome-avatar">{initials(access?.user?.fullName)}</div><div><small>باشگاه مراقبین سلامت اول</small><h1>سلام، {text(access?.user?.fullName,"کاربر")}</h1><p>{access?.user?.roleLabel||roleFa[String(access?.user?.role||"").toUpperCase()]||"کاربر سازمانی"}</p></div></section><Card className="ma-workforce-card"><div><small>وضعیت عملیاتی مراقبین</small><strong>چرخه درخواست تا قرارداد</strong></div><div className="ma-workforce-grid"><Metric label="مراقب فعال" value={workforce?fa(workforce.activeCaregivers):"…"}/><Metric label="در وضعیت اعزام" value={workforce?fa(workforce.dispatchCaregivers):"…"}/><Metric label="در قرارداد" value={workforce?fa(workforce.inContractCaregivers):"…"}/><Metric label="متقاضی قرارداد" value={workforce?fa(workforce.contractApplicants):"…"}/></div></Card><section className="ma-module-grid">{modules.map(module=>{const route=keyToRoute[module.key],Icon=routeMeta[route].icon;return <button className="ma-module" key={module.key} onClick={()=>navigate(route)}><span><Icon size={25}/></span><strong>{module.label}</strong>{module.key==="staff.job_ads"&&<MobileJobRequestUnreadDotV1/>}</button>})}</section></div>}\n'
if new not in s:
    if old not in s:
        raise SystemExit("mobile dashboard anchor not found")
    s = s.replace(old, new, 1)
# Import a tiny isolated stylesheet for the new mobile card.
css_import = 'import "./admin-workforce-summary-v1.css";\n'
admin_css = 'import "./admin.css";\n'
if css_import not in s:
    if admin_css not in s:
        raise SystemExit("mobile css import anchor not found")
    s = s.replace(admin_css, admin_css + css_import, 1)
p.write_text(s)
