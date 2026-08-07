import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const backend=read('worker/referral-rewards-v2.ts');
const runtime=read('preview/referral-rewards-experience-v2.js');
const index=read('worker/index-referral-rewards.ts');
const migration=read('migrations/0107_referral_confirmation_milestones.sql');

const requireText=(source,needle,message)=>{
  if(!source.includes(needle))throw new Error(message||`Missing required marker: ${needle}`);
};

requireText(backend,'const REGISTRATION_REWARD_TOMAN = 200_000','Registration reward must remain 200,000 toman.');
requireText(backend,'const CONTRACT_REWARD_TOMAN = 300_000','Contract reward must remain 300,000 toman.');
requireText(backend,'const MILESTONE_SIZE = 10','Milestone size must be 10 successful contracts.');
requireText(backend,'const MILESTONE_REWARD_TOMAN = 5_000_000','Milestone reward must be 5,000,000 toman.');
requireText(backend,'crypto.getRandomValues','Referral code generation must use Web Crypto randomness.');
requireText(backend,"String(100_000 + (value % 900_000))",'Referral code must be exactly six numeric digits.');
requireText(backend,"referrer_confirmation_status='APPROVED'",'Admin reward flow must depend on referrer approval.');
requireText(backend,"referrer_confirmation_status<>'APPROVED'",'Unconfirmed referrals must stay out of the staff action queue.');
requireText(backend,"'REFERRAL_MILESTONE_REWARD'",'Milestone awards must be wallet transactions.');
requireText(backend,'/api/caregiver/platform/referrals','Caregiver confirmation API is required.');

requireText(migration,'CREATE TABLE IF NOT EXISTS caregiver_referral_codes','Dedicated referral-code table is required.');
requireText(migration,'referral_code TEXT NOT NULL UNIQUE','Referral codes must be unique.');
requireText(migration,"length(referral_code)=6",'Referral codes must be six digits at database level.');
requireText(migration,'referrer_confirmation_status','Referrer confirmation state must be persisted.');
requireText(migration,'CREATE TABLE IF NOT EXISTS caregiver_referral_milestones','Milestone awards must be persisted idempotently.');
requireText(migration,'reward_toman INTEGER NOT NULL DEFAULT 5000000','Milestone reward database invariant must be 5,000,000 toman.');

requireText(runtime,"pageTitle()==='کیف پول و اعتبارات'",'Referral experience must live inside wallet and credits.');
requireText(runtime,'refv2-gauge','Caregiver must see schematic 10-referral progress.');
requireText(runtime,'navigator.clipboard.writeText','Dashboard referral code must be copyable.');
requireText(runtime,"$('#referralDashboardCodeV2')",'Dashboard referral-code card is required.');
requireText(runtime,'data-refv2-confirm','Referrer confirmation control is required in caregiver wallet.');
requireText(runtime,'۵ میلیون','Milestone reward messaging must be visible to caregiver.');
if(runtime.includes('data-caregiver-module-key="caregiver.referral"'))throw new Error('Referral v2 must not create a new caregiver navigation module.');

requireText(index,'routeReferralRewardsV2','Top-level worker must route through referral v2.');
requireText(index,'referral-rewards-experience-v2.js','Referral v2 experience must be injected into existing surfaces.');

console.log('Referral rewards v2 contract validated.');
