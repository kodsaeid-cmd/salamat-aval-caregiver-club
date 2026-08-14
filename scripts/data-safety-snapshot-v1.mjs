import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const out=process.argv[2];
if(!out)throw new Error('Usage: node scripts/data-safety-snapshot-v1.mjs <output.json>');
const db=process.env.DB_NAME||'salamat-aval-caregiver-club';
const config=process.env.WRANGLER_CONFIG||'wrangler.backend.jsonc';

function exec(sql){
  const raw=execFileSync('npx',['wrangler','d1','execute',db,'--remote','--config',config,`--command=${sql}`,'--json'],{encoding:'utf8',stdio:['ignore','pipe','inherit']});
  const parsed=JSON.parse(raw);
  const rows=[];
  const walk=v=>{if(Array.isArray(v)){for(const x of v)walk(x);return}if(v&&typeof v==='object'){if(v.results&&Array.isArray(v.results))rows.push(...v.results);for(const x of Object.values(v))if(x!==v.results)walk(x)}};
  walk(parsed);return rows;
}
function scalar(sql,key='value'){const row=exec(sql)[0]||{};return Number(row[key]??row.value??0)}
function tableExists(name){return scalar(`SELECT COUNT(*) AS value FROM sqlite_master WHERE type='table' AND name='${name.replaceAll("'","''")}';`)>0}
const metric=(table,sql)=>tableExists(table)?scalar(sql):null;
const snapshot={
  version:1,
  createdAt:new Date().toISOString(),
  gitCommit:process.env.GITHUB_SHA||'',
  database:db,
  metrics:{
    users:metric('users','SELECT COUNT(*) AS value FROM users;'),
    caregivers:metric('caregivers','SELECT COUNT(*) AS value FROM caregivers;'),
    activeUsers:metric('users',"SELECT COUNT(*) AS value FROM users WHERE UPPER(status) IN ('ACTIVE','APPROVED');"),
    finalEvaluations:metric('caregiver_evaluation_periods',"SELECT COUNT(*) AS value FROM caregiver_evaluation_periods WHERE status='FINAL' AND archived_at IS NULL;"),
    finalEvaluationScoreSum:metric('caregiver_evaluation_periods',"SELECT COALESCE(SUM(final_score),0) AS value FROM caregiver_evaluation_periods WHERE status='FINAL' AND archived_at IS NULL;"),
    contractPointRows:metric('caregiver_contract_point_ledger','SELECT COUNT(*) AS value FROM caregiver_contract_point_ledger;'),
    contractPointTotal:metric('caregiver_contract_point_ledger','SELECT COALESCE(SUM(points),0) AS value FROM caregiver_contract_point_ledger;'),
    walletTransactionRows:metric('caregiver_wallet_transactions','SELECT COUNT(*) AS value FROM caregiver_wallet_transactions;'),
    walletCreditTotal:metric('caregiver_wallet_transactions',"SELECT COALESCE(SUM(amount_toman),0) AS value FROM caregiver_wallet_transactions WHERE direction='CREDIT';"),
    walletDebitTotal:metric('caregiver_wallet_transactions',"SELECT COALESCE(SUM(amount_toman),0) AS value FROM caregiver_wallet_transactions WHERE direction='DEBIT';"),
    creditRequestRows:metric('caregiver_credit_requests','SELECT COUNT(*) AS value FROM caregiver_credit_requests;'),
    contractRows:metric('contracts','SELECT COUNT(*) AS value FROM contracts;'),
    jobApplicationRows:metric('care_job_applications','SELECT COUNT(*) AS value FROM care_job_applications;'),
    referralCaseRows:metric('caregiver_referral_cases','SELECT COUNT(*) AS value FROM caregiver_referral_cases;'),
    referralStage1Rows:metric('caregiver_referral_cases','SELECT COUNT(*) AS value FROM caregiver_referral_cases WHERE registration_reward_transaction_id IS NOT NULL;'),
    referralStage2Rows:metric('caregiver_referral_cases','SELECT COUNT(*) AS value FROM caregiver_referral_cases WHERE contract_reward_transaction_id IS NOT NULL;'),
    referralCohortRows:metric('caregiver_referral_milestone_cohorts','SELECT COUNT(*) AS value FROM caregiver_referral_milestone_cohorts;'),
    referralMilestoneRequestRows:metric('caregiver_referral_milestone_requests','SELECT COUNT(*) AS value FROM caregiver_referral_milestone_requests;'),
    referralMilestoneEventRows:metric('caregiver_referral_milestone_request_events','SELECT COUNT(*) AS value FROM caregiver_referral_milestone_request_events;'),
    referralRecurringLoanRequestRows:metric('caregiver_referral_recurring_loan_requests','SELECT COUNT(*) AS value FROM caregiver_referral_recurring_loan_requests;'),
    referralRecurringLoanCompletedRows:metric('caregiver_referral_recurring_loan_requests',"SELECT COUNT(*) AS value FROM caregiver_referral_recurring_loan_requests WHERE status='COMPLETED';"),
    referralRecurringLoanEventRows:metric('caregiver_referral_recurring_loan_request_events','SELECT COUNT(*) AS value FROM caregiver_referral_recurring_loan_request_events;'),
  }
};
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(snapshot,null,2)+'\n');
console.log(JSON.stringify(snapshot.metrics,null,2));
