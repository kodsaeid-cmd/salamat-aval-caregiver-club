import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const expect=(ok,message)=>{if(!ok)throw new Error(`Contract progress validation failed: ${message}`)};

const engine=read('worker/contract-progress-engine-v1.ts');
const migration=read('migrations/0110_contract_progress_engine.sql');
const outer=read('worker/index-desktop-react-v1.ts');
const points=read('worker/point-benefits-v1.ts');
const jobs=read('mobile-react/caregiver-job-ads-v1.tsx');
const jobsCss=read('mobile-react/caregiver-job-ads-v1.css');
const rtlCss=read('mobile-react/caregiver-contract-progress-rtl-v1.css');
const entry=read('mobile-react/caregiver-entry-v5.tsx');
const welcome=read('mobile-react/caregiver-contract-welcome-v1.tsx');

expect(engine.includes('const POINT_SCALE=100'), 'hundredth-point integer scale is missing');
expect(engine.includes("points_model")&&engine.includes('DAILY_V1')&&engine.includes('LEGACY_PREPAID'), 'daily and legacy point models are missing');
expect(engine.includes("CREATE UNIQUE INDEX IF NOT EXISTS idx_caregiver_one_active_job_contract"), 'one-active-contract database invariant is missing');
expect(engine.includes('INSERT OR IGNORE INTO caregiver_contract_point_daily_ledger'), 'idempotent daily point ledger write is missing');
expect(engine.includes('Math.floor(Math.max(0,at-started)/DAY_MS)'), 'completed full service day calculation is missing');
expect(engine.includes('job_bank_locked_by_active_contract'), 'server-side job bank lock is missing');
expect(engine.includes('caregiver_already_in_contract'), 'server-side second-contract rejection is missing');
expect(engine.includes('welcome-seen'), 'server-persisted welcome acknowledgement route is missing');
expect(engine.includes('/withdraw'), 'caregiver withdrawal route is missing');
expect(engine.includes("status='ENDED_EARLY'"), 'early contract termination state is missing');
expect(engine.includes("UPDATE care_job_ads SET status='DRAFT'"), 'withdrawal replacement workflow does not return ad to staff draft');
expect(engine.includes('reconcileAllActiveContracts'), 'scheduled reconciliation export is missing');
const startSegment=engine.split('async function startContract')[1]?.split('async function endActiveContract')[0]||'';
expect(startSegment&&!startSegment.includes('INSERT OR IGNORE INTO caregiver_contract_point_ledger'), 'new contract start still awards the old full-point ledger');

expect(migration.includes("WHERE status='ACTIVE'"), 'migration lacks partial unique active-contract index');
expect(migration.includes('UNIQUE(contract_id,service_day)'), 'migration lacks idempotent service-day uniqueness');
expect(migration.includes('trg_daily_contract_points_no_update')&&migration.includes('trg_daily_contract_points_no_delete'), 'daily point ledger is not append-only');

expect(outer.includes('routeContractProgressEngine(request, env)'), 'outer worker does not route job ads through the contract progress engine');
expect(outer.includes('ctx.waitUntil(reconcileAllActiveContracts(env))'), 'daily scheduled reconciliation is not attached to the active worker');
expect(points.includes('contractProgressPointsSummary'), 'benefit/loan totals do not use earned contract points');
expect(points.includes('caregiver_contract_point_ledger+caregiver_contract_point_daily_ledger'), 'financial data-unity source does not declare legacy plus daily ledgers');

expect(jobs.includes('ActiveContractCard'), 'active contract progress card is missing');
expect(jobs.includes('امتیاز امروز در حال ساخته‌شدن است'), 'dynamic daily points copy is missing');
expect(jobs.includes('/withdraw'), 'withdrawal action is not wired in caregiver UI');
expect(jobs.includes('withdrawConfirmed'), 'two-step withdrawal confirmation is missing');
expect(jobs.includes('اگر وارد قرارداد شوید، این امتیاز یکجا واریز نمی‌شود'), 'job detail does not explain daily accrual');
expect(jobsCss.includes('@keyframes cja-flow')&&jobsCss.includes('.cja-generator'), 'looping score-generation animation is missing');
expect(jobsCss.includes('@media(prefers-reduced-motion:reduce)'), 'reduced-motion accessibility is missing');
expect(rtlCss.includes('scaleX(-1)')&&rtlCss.includes('.cja-earned-fill{left:0;right:auto}'), 'contract progress does not advance in RTL direction');
expect(entry.includes('./caregiver-contract-progress-rtl-v1.css'), 'RTL progress override is not loaded after caregiver app styles');
expect(entry.includes('./caregiver-contract-welcome-v1'), 'one-time contract welcome is not loaded on caregiver panel entry');
expect(welcome.includes('/api/caregiver/contracts/active')&&welcome.includes('/welcome-seen'), 'welcome modal is not server-persisted');

console.log('Contract Progress Engine v1 invariants are valid for caregiver mobile and desktop.');
