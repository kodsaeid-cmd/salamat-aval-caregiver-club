import fs from "node:fs";

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const lifecycle=read("worker/job-application-lifecycle-v1.ts");
const filters=read("worker/staff-job-ad-list-filters-v1.ts");
const daily=read("worker/job-application-daily-limit-v1.ts");
const sms=read("worker/job-application-status-sms-v1.ts");
const ui=read("shared/job-application-referred-stage-runtime-v1.ts");
const css=read("shared/job-application-referred-stage-v1.css");
const entry=read("desktop-react/job-ads-v1.tsx");

const checks=[
 [lifecycle.includes('if(next===REFERRED_TO_CONSULTANT)return "PENDING_CONSULTANT"'),"legacy shadow must stay PENDING_CONSULTANT"],
 [filters.includes('"REQUESTED","REFERRED","DISPATCH","CONTRACT"'),"REFERRED applicant filter stage missing"],
 [filters.includes("REFERRED_TO_CONSULTANT"),"canonical referred status missing from list filter"],
 [filters.includes("application-lifecycle"),"canonical application lifecycle endpoint missing"],
 [daily.includes('"PENDING_CONSULTANT","REFERRED_TO_CONSULTANT","TRIAL_DISPATCH"'),"referred applications must count as active requests"],
 [daily.includes("trg_caregiver_daily_active_job_application_limit_v2"),"daily-limit v2 trigger missing"],
 [sms.includes('REFERRED_TO_CONSULTANT:"معرفی شده به مشاور پرونده"'),"caregiver SMS label missing"],
 [ui.includes('option.value="REFERRED"')&&ui.includes('option.textContent="متقاضی معرفی شده"'),"admin applicant filter option missing"],
 [ui.includes('referred.textContent="معرفی به مشاور پرونده"'),"referred action must appear before trial dispatch"],
 [ui.includes('setStatusButtonState(pending,application.status==="PENDING_CONSULTANT"'),"pending status must show as the active applicant state"],
 [ui.includes('setStatusButtonState(referred,application.status===REFERRED_STATUS'),"referred status must only show active when canonical status is referred"],
 [ui.includes('setStatusButtonState(trial,application.status==="TRIAL_DISPATCH"'),"trial status must show as the active applicant state"],
 [ui.includes('setStatusButtonState(reject,application.status==="REJECTED"'),"rejected status must show as the active applicant state"],
 [ui.includes('setStatusButtonState(contract,application.status==="IN_CONTRACT"'),"contract status must show as the active applicant state"],
 [ui.includes('state.textContent!==REFERRED_LABEL'),"referred label DOM mutation must be idempotent to prevent MutationObserver loops"],
 [ui.includes('let enhanceQueued=false')&&ui.includes('requestAnimationFrame(()=>{enhanceQueued=false;enhance()})'),"enhancer mutations must be frame-coalesced"],
 [ui.includes('new MutationObserver(()=>scheduleEnhance())'),"MutationObserver must use the coalesced enhancer"],
 [css.includes('.ja-status-actions .ja-referred{border-color:#dfe9e4;background:#fff;color:#52675d}'),"referred action must be neutral unless it is the active state"],
 [css.includes('button.ja-status-choice:hover:not(:disabled)')&&css.includes('transform:translateY(-1px)'),"applicant status actions need visible hover affordance"],
 [css.includes('grid-template-columns:repeat(5'),"five applicant lifecycle actions must fit the desktop status row"],
 [entry.includes('job-application-referred-stage-runtime-v1'),"job ads entry does not load referred-stage runtime"],
];
const failed=checks.filter(([ok])=>!ok);
if(failed.length){for(const [,message] of failed)console.error(`FAIL: ${message}`);process.exit(1)}
console.log("job application referred stage v1: ok");
