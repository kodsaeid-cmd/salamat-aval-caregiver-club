import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const backend=read('worker/referral-rewards-v2.ts');
const runtime=read('preview/referral-rewards-experience-v2.js');
const financial=read('preview/server-financial-profile-v4.js');
const profile=read('worker/caregiver-financial-profile-v4.ts');
const index=read('worker/index-referral-rewards.ts');
const outer=read('worker/index-unified-financial-v4.ts');
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

// Referral experience v2 stays dashboard-only for speed; wallet ownership is canonical financial v4.
requireText(runtime,"const VERSION='2.2.0'",'Dashboard referral experience must be cache-busted.');
requireText(runtime,'navigator.clipboard.writeText','Dashboard referral code must be copyable.');
requireText(runtime,"$('#referralDashboardCodeV2')",'Dashboard referral-code card is required.');
requireText(runtime,"$('#caregiverReferralRewardsV2')?.remove()",'Legacy duplicate caregiver wallet referral renderer must be disabled.');
if(runtime.includes('data-caregiver-module-key="caregiver.referral"'))throw new Error('Referral v2 must not create a new caregiver navigation module.');

requireText(financial,'معرفی و اعتبارات معرفی مراقب','Referral experience must live inside unified wallet and credits.');
requireText(financial,'تا پاداش ۵ میلیونی','Caregiver must see schematic 10-referral progress.');
requireText(financial,'data-ref="CONFIRM"','Referrer confirmation control is required in caregiver wallet.');
requireText(financial,'data-ref="REJECT"','Referrer rejection control is required in caregiver wallet.');
requireText(financial,'conic-gradient','Referral progress must use the lightweight donut/pie visual language.');
requireText(financial,'data-copy','Wallet referral code must remain copyable.');

requireText(profile,'caregiver_referral_cases','Unified profile must source referral cases server-side.');
requireText(profile,'caregiver_referral_milestones','Unified profile must source milestone rewards server-side.');
requireText(profile,'remainingToMilestone','Unified profile must calculate next 5M milestone progress.');

requireText(index,'routeReferralRewardsV2','Referral wrapper must still route referral v2.');
requireText(index,'referral-rewards-experience-v2.js','Dashboard referral experience must still be injected.');
requireText(outer,'import app from "./index-referral-rewards"','Unified financial entry must preserve referral routing chain.');

console.log('Referral rewards v2 contract validated inside unified financial v4.');