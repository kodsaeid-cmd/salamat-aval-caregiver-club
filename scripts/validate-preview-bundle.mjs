import { readFile } from 'node:fs/promises';

const caregiverParts = await Promise.all([
  'preview/cp2-00.txt',
  'preview/cp2-01.txt',
  'preview/cp2-02.txt',
].map((path) => readFile(path, 'utf8')));

new Function(caregiverParts.join(''));
console.log('Caregiver panel v2 bundle syntax is valid.');

const evaluationSource = await readFile('preview/evaluation-system.js', 'utf8');
new Function(evaluationSource);
console.log('Evaluation system v1.3 syntax is valid.');

const governanceSource = await readFile('preview/evaluation-governance.js', 'utf8');
new Function(governanceSource);
console.log('Evaluation governance workflow syntax is valid.');

const heroSource = await readFile('preview/hero.js', 'utf8');
new Function(heroSource);
console.log('High-resolution login hero loader syntax is valid.');

const accessProfileSource = await readFile('preview/access-profile.js', 'utf8');
new Function(accessProfileSource);
console.log('Access control, caregiver profile and rank-license UI syntax is valid.');

const caregiverRegistrationSource = await readFile('preview/caregiver-registration.js', 'utf8');
new Function(caregiverRegistrationSource);
if (!caregiverRegistrationSource.includes("role:'caregiver'") || !caregiverRegistrationSource.includes("status:'pending'") || !caregiverRegistrationSource.includes('caregiverId')) {
  throw new Error('Self-registration must create a linked pending caregiver account and professional profile.');
}
console.log('Caregiver self-registration and linked pending profile flow syntax is valid.');

const featureUpgradesSource = await readFile('preview/feature-upgrades.js', 'utf8');
new Function(featureUpgradesSource);
for (const marker of ['MAX_UPLOAD=200*1024*1024', 'admTrainingForm', 'admEvalCare', 'globalNotificationPanel', 'ایمیل سازمانی (نام کاربری)', 'workflow-stability.js']) {
  if (!featureUpgradesSource.includes(marker)) throw new Error(`Feature upgrade marker missing: ${marker}`);
}
if (featureUpgradesSource.includes("observe(document.body,{subtree:true")) {
  throw new Error('Feature upgrades must not observe the full document subtree because it causes render loops.');
}
console.log('Admin upload, caregiver search, email login and notification upgrades syntax is valid.');

const trainingStorageSource = await readFile('preview/training-file-storage.js', 'utf8');
new Function(trainingStorageSource);
if (!trainingStorageSource.includes('MAX_UPLOAD=200*1024*1024') || !trainingStorageSource.includes('indexedDB')) {
  throw new Error('Training file storage must persist files in IndexedDB with a 200MB limit.');
}
if (trainingStorageSource.includes("observe(document.body,{childList:true,subtree:true")) {
  throw new Error('Training storage must not observe the full page subtree.');
}
console.log('Training file persistence and stable page-scoped enhancement syntax is valid.');

const workflowStabilitySource = await readFile('preview/workflow-stability.js', 'utf8');
new Function(workflowStabilitySource);
for (const marker of ['stableTrainingAssignForm', 'stableRecipientSearch', 'renderCaregiverTraining', 'renderCaregiverCalendar', 'leaveHour', 'caseName', 'removeSearchButtons', 'workflow-stability.css']) {
  if (!workflowStabilitySource.includes(marker)) throw new Error(`Workflow stability marker missing: ${marker}`);
}
console.log('Searchable training assignment, caregiver learning and interactive calendar syntax is valid.');

const dynamicIdentitySource = await readFile('preview/dynamic-identity.js', 'utf8');
new Function(dynamicIdentitySource);
for (const marker of ['resolveLoggedInIdentity', 'model.name=identity.name', 'caregiverId', 'خوش آمدید', 'salamat-identity-changed', 'caregiver-license-print.js']) {
  if (!dynamicIdentitySource.includes(marker)) throw new Error(`Dynamic identity marker missing: ${marker}`);
}
console.log('Logged-in user identity, profile linkage and personalized welcome syntax is valid.');

const caregiverLicenseSource = await readFile('preview/caregiver-license-print.js', 'utf8');
new Function(caregiverLicenseSource);
for (const marker of ['HIDDEN_MODULES', 'رتبه و پروانه', 'درجه و رتبه', 'دانلود پروانه', 'پروانه فنی مراقب', 'window.print']) {
  if (!caregiverLicenseSource.includes(marker)) throw new Error(`Caregiver license marker missing: ${marker}`);
}
const caregiverLicenseStyles = await readFile('preview/caregiver-license-print.css', 'utf8');
for (const marker of ['@page', 'size:A4 portrait', 'printing-caregiver-license', 'caregiver-license-print-target']) {
  if (!caregiverLicenseStyles.includes(marker)) throw new Error(`Caregiver A4 print style marker missing: ${marker}`);
}
console.log('Hidden caregiver rank-license module and A4 technical license output are valid.');

const loginPageSource = await readFile('preview/index.html', 'utf8');
for (const marker of ['openCaregiverRegistration', 'caregiverSignupForm', 'feature-upgrades.js?v=2.1.0', 'training-file-storage.js?v=2.1.0', 'dynamic-identity.js', 'ایمیل سازمانی / نام کاربری', 'تشکیل پروفایل و ارسال درخواست عضویت']) {
  if (!loginPageSource.includes(marker)) throw new Error(`Login and registration marker missing: ${marker}`);
}
if (loginPageSource.includes('data-icon="search"')) {
  throw new Error('The global topbar search button must be removed from all panels.');
}
if (loginPageSource.includes('id="sidebarName">مریم حسینی') || loginPageSource.includes('id="topName">مریم حسینی')) {
  throw new Error('Static sample identity must not remain in the visible application shell.');
}
console.log('Caregiver registration, dynamic identity, and search-free topbar entry points are present.');

const adminFunctionalSource = await readFile('preview/admin-functional.js', 'utf8');
new Function(adminFunctionalSource);
console.log('Functional admin workspace and dynamic caregiver identity syntax is valid.');

const workerSource = await readFile('worker.js', 'utf8');
for (const marker of ['PREVIEW_AUTH_ENABLED', 'PREVIEW_AUTH_USERNAME', 'PREVIEW_AUTH_PASSWORD', 'env.ASSETS.fetch', 'Content-Security-Policy']) {
  if (!workerSource.includes(marker)) throw new Error(`Security worker marker missing: ${marker}`);
}
new Function(workerSource.replace('export default {', 'return {'));

const wranglerConfig = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
if (wranglerConfig.name !== 'salamat-aval-caregiver-club') throw new Error('Wrangler Worker name is incorrect.');
if (wranglerConfig.main !== './worker.js') throw new Error('Wrangler main entry must point to ./worker.js.');
if (wranglerConfig.assets?.directory !== './preview') throw new Error('Wrangler assets directory must point to ./preview.');
if (wranglerConfig.assets?.binding !== 'ASSETS') throw new Error('Wrangler assets binding must be ASSETS.');
if (wranglerConfig.assets?.run_worker_first !== true) throw new Error('Security Worker must run before static assets.');

const assetsIgnore = await readFile('preview/.assetsignore', 'utf8');
for (const marker of ['_worker.js', '_headers', '_redirects']) {
  if (!assetsIgnore.split(/\r?\n/).includes(marker)) throw new Error(`Assets ignore marker missing: ${marker}`);
}
console.log('Cloudflare Workers entry point, static assets binding, and deployment configuration are valid.');
