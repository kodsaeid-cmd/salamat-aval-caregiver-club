import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Loan/retention policy v1 failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message||`missing ${value}`);
const lacks=(source,value,message)=>expect(!source.includes(value),message||`forbidden ${value}`);

const points=read('worker/point-benefits-v1.ts');
const loans=read('worker/loan-credit-policy-v2.ts');
const rewards=read('worker/retention-rewards-v1.ts');
const migration=read('migrations/0109_loan_policy_retention_rewards.sql');
const root=read('worker/index-desktop-react-v1.ts');
const contractWrapper=read('worker/staff-contracts-retention-v2.ts');
const profile=read('worker/caregiver-financial-referral-fix-v1.ts');
const caregiver=read('mobile-react/caregiver-benefits-v3.tsx');
const build=read('scripts/build-mobile-react.mjs');
const desktop=read('desktop-react/financial-credits-v4.tsx');
const desktopLoans=read('desktop-react/financial-credits-loan-policy-v5.tsx');
const mobile=read('mobile-react/admin-financial-credits-v4.tsx');
const mobileLoans=read('mobile-react/admin-financial-credits-loan-policy-v4.tsx');
const router=read('mobile-react/admin-router-v2.tsx');

for(const [key,amount,score] of [
 ['POINT_LOAN_200','10_000_000','targetPoints:200'],
 ['POINT_LOAN_400','25_000_000','targetPoints:400'],
 ['POINT_LOAN_600','50_000_000','targetPoints:600'],
 ['POINT_LOAN_800','70_000_000','targetPoints:800'],
]){
 has(points,key,`loan tier missing ${key}`);
 has(points,`amountToman:${amount}`,`loan amount missing ${amount}`);
 has(points,score,`loan point threshold missing ${score}`);
}
has(points,'MIN_LOAN_EVALUATION_SCORE=60','evaluation threshold must be 60');
has(points,'const eligible=pointsPassed&&evaluationPassed','loan eligibility must require points AND evaluation');
has(points,"status='FINAL' AND final_score IS NOT NULL",'loan evaluation must come from a finalized evaluation');
has(points,'data.allowance=null','old allowance must be retired from the active loan payload');
for(const oldRule of ['REFERRAL_LOAN_10','ASSISTANCE_2M','LOAN_3M','LOAN_6M','LOAN_12M','LOAN_24M','LOAN_70M_CUMULATIVE'])has(points,oldRule,`retired rule must be declared: ${oldRule}`);

has(loans,'caregiverLoanPolicy(env,actor.caregiverId)','caregiver request must use canonical live policy');
has(loans,'const policy=await caregiverLoanPolicy(env,row.caregiverId)','manager approval must re-check canonical live policy');
has(loans,'if(!tier.eligible)return fail','manager approval must block ineligible loans');
has(loans,'loan_policy_retired','legacy loan requests must not be approved under the new policy');
has(loans,'TIER_KEYS','only canonical four loan tiers may be requested');

for(const value of ['FIRST_REWARD_TOMAN=1_000_000','FIRST_MIN_DAYS=60','return sequence===4?800:sequence===5?1100:sequence>=6?1500:0','previous.some(contract=>contract.status!=="COMPLETED")','const source=contracts[index-3]','reference_type','RETENTION_REWARD','NETWORK_RETENTION_REWARD','CONTRACT_CONTINUITY_REWARD','WAITING_FRANCHISE','PENDING_APPROVAL'])has(rewards,value,`retention reward rule missing ${value}`);
has(rewards,'ACTIVE_TARGET_STATUSES.has(first.status)&&firstDays>=FIRST_MIN_DAYS','first-contract reward must require 60 served days');
has(rewards,'ACTIVE_TARGET_STATUSES.has(target.status)','continuity reward must require entry into the target contract');
has(rewards,'Math.round(franchiseToman*rateBasisPoints/10_000)','continuity amount must derive from source franchise');

for(const value of ['franchise_toman','caregiver_retention_rewards','FIRST_CONTRACT_RETENTION','CONTRACT_CONTINUITY','800,1100,1500'])has(migration,value,`migration contract missing ${value}`);
has(contractWrapper,'reconcileRetentionRewardsForCaregiver','contract writes must reconcile retention eligibility');
has(profile,'buildCaregiverRetentionRewardsSummary','caregiver/staff financial profile must expose retention rewards');
has(profile,'applyPointBenefitsToFinancialPayload','financial profile must expose canonical loan policy');

for(const value of ['routeLoanCreditPolicyV2','routeRetentionRewardsV1','routeStaffContractsRetentionV2'])has(root,value,`active root must own ${value}`);
lacks(root,'routeReferralLoanCreditV1','referral-count loan route must not own active requests');

for(const value of ['وام و تسهیلات','پاداش‌ها','معرفی‌ها','درخواست‌ها','۱۰ میلیون','۲۵ میلیون','۵۰ میلیون','۷۰ میلیون','۲۰۰ امتیاز','۴۰۰ امتیاز','۶۰۰ امتیاز','۸۰۰ امتیاز','حداقل ۶۰','پاداش اولین قرارداد','۸٪ فرانشیز قرارداد ۱','۱۱٪ فرانشیز قرارداد ۲','۱۵٪ فرانشیز قرارداد سه پله قبل'])has(caregiver,value,`caregiver Benefits UI missing ${value}`);
for(const value of ['caregiver-benefits-policy-v3','caregiver-finance-bridge-v3.tsx'])has(build,value,`production caregiver bundle bridge missing ${value}`);

for(const value of ['پرونده مالی و وام','پاداش معرفی','پاداش ماندگاری','RetentionRewardsAdmin'])has(desktop,value,`desktop financial credits tabs missing ${value}`);
for(const value of ['۲۰۰','۴۰۰','۶۰۰','۸۰۰','میانگین ارزیابی','حداقل مجاز'])has(desktopLoans,value,`desktop manager loan UI missing ${value}`);
for(const value of ['وام و پرونده مالی','پاداش معرفی','پاداش ماندگاری','AdminRetentionRewardsMobileV1'])has(mobile,value,`mobile manager financial tabs missing ${value}`);
for(const value of ['200','400','600','800','میانگین ارزیابی','حداقل میانگین شاخص‌ها'])has(mobileLoans,value,`mobile manager loan UI missing ${value}`);
has(router,'AdminFinancialCreditsMobileV4 as AdminFinancialCreditsMobileV3','mobile router must preserve parity alias while activating finance v4');

console.log('Loan/retention policy v1 passed: four point tiers + FINAL evaluation >=60 are authoritative for request/approval, and retention rewards are isolated with 60-day + 8/11/15% rules on desktop/mobile.');
