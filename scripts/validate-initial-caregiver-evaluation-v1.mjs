import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const expect=(ok,msg)=>{if(!ok)throw new Error(`Initial caregiver evaluation validation failed: ${msg}`)};
const migration=read('migrations/0121_initial_caregiver_evaluation.sql');
const backend=read('worker/initial-caregiver-evaluation-v1.ts');
const owner=read('worker/index-caregiver-onboarding-permission-defaults-v2.ts');
const wrangler=read('wrangler.backend.jsonc');
const shared=read('shared/initial-evaluation-v2.tsx');
const desktopEval=read('desktop-react/evaluations-v4.tsx');
const mobileEval=read('mobile-react/admin-evaluations-v5.tsx');
const desktopDossier=read('desktop-react/caregiver-directory-filters-v1.tsx');
const mobileDossier=read('mobile-react/admin-caregivers-v6.tsx');
const caregiverScorecard=read('shared/caregiver-mobile-scorecard-tabs-v1.ts');

for(const table of ['caregiver_initial_evaluation_periods','caregiver_initial_evaluation_axis_scores','caregiver_initial_evaluation_delegates'])expect(migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`),`missing additive table ${table}`);
expect(!/DROP\s+TABLE|DELETE\s+FROM\s+caregiver_evaluation/i.test(migration),'migration is not additive/data-safe');
expect(backend.includes('normalizeRole(user.role)==="CAREGIVER"')&&backend.includes('initial_evaluation_staff_only'),'caregiver hard confidentiality gate is missing');
expect(backend.includes('POLICY_V1="INITIAL-1405-V1"')&&backend.includes('POLICY_V2="INITIAL-1405-V2"'),'legacy and current policy versions must coexist');
expect(backend.includes('axesForPolicy')&&backend.includes('period.policyVersion===POLICY_V2'),'historical evaluation rows must be interpreted by their own policy version');
expect(!backend.includes('UPDATE caregivers SET professional_score'),'initial evaluation must never overwrite the professional evaluation score');
expect(backend.includes('SAVE_INITIAL_EVALUATION_AXIS')&&backend.includes('FINALIZE_INITIAL_EVALUATION'),'audit trail is incomplete');
expect(owner.includes('routeInitialCaregiverEvaluationV1')&&wrangler.includes('"main": "./worker/index-desktop-react-v1.ts"'),'private API route must remain in the canonical production chain');

const v2=backend.split('const AXES_V2=[')[1]?.split('] as const;')[0]||'';
for(const code of ['APPEARANCE','NEGATIVE_APPEARANCE','PERSONALITY','PHYSICAL','EXPERIENCE','JOB_CERT','DIALECT'])expect(v2.includes(`code:"${code}"`),`current qualitative axis missing: ${code}`);
for(const code of ['ATTENTION','TRAINABILITY','RELIABILITY','EDUCATION'])expect(!v2.includes(`code:"${code}"`),`removed axis still exists in current form: ${code}`);
for(const legacyLabel of ['بهداشت فردی','ضریب هوشی، توجه و تمرکز','آموزش‌پذیر','قابلیت اعتماد','تحصیلات'])expect(backend.includes(legacyLabel),`legacy history definition removed: ${legacyLabel}`);
expect(v2.includes('title:"ظاهر و پوشش"')&&v2.includes('title:"نکات منفی ظاهر مراقب"')&&v2.includes('title:"مدرک مرتبط با شغل"'),'label-only axes are not defined correctly');
expect(backend.includes('qualitativeAnalysis')&&backend.includes('finalScore:null')&&backend.includes('فاقد امتیاز عددی'),'current evaluation must finalize without a hidden numeric score');

for(const label of ['نکات منفی ظاهر مراقب','مودب','آموزش‌پذیری','در مراکز سلامت اول یا مراکز دیگر','قد (سانتی‌متر)','وزن (کیلوگرم)','مدرک مرتبط با شغل','ترک','لر','گیلک','بلوچ','کرمانج','ترکمن','غیره'])expect(shared.includes(label),`current form UI missing: ${label}`);
expect(shared.includes('otherDialect')&&shared.includes('dialect')&&shared.includes('OTHER'),'OTHER dialect explanation contract is missing');
expect(!shared.includes('SCORE_LABELS')&&!shared.includes('امتیاز بدوی از ۱۰۰'),'current form must not expose a Likert or numeric initial-evaluation score');
expect(shared.includes('report:"1"')&&shared.includes('InitialEvaluationReportV2'),'read-only report mode is missing');

expect(desktopEval.includes('InitialEvaluationWorkspaceV2')&&desktopEval.includes('ارزیابی بدوی'),'desktop evaluation module must own the initial evaluation form');
expect(mobileEval.includes('AdminInitialEvaluationMobileV2')&&mobileEval.includes('ارزیابی بدوی'),'mobile evaluation module must own the initial evaluation form');
expect(desktopDossier.includes('InitialEvaluationReportV2')&&!desktopDossier.includes('InitialEvaluationTab'),'desktop caregiver dossier must contain only the read-only initial evaluation report');
expect(mobileDossier.includes('InitialEvaluationReportV2')&&mobileDossier.includes('"initial"'),'mobile caregiver dossier must expose the read-only initial evaluation in a separate tab');
expect(!caregiverScorecard.includes('/api/staff/initial-evaluations'),'caregiver scorecard must never request initial-evaluation results');
console.log('Initial evaluation v2: qualitative form, legacy preservation, admin-only reporting, desktop/mobile placement and caregiver confidentiality: OK');
