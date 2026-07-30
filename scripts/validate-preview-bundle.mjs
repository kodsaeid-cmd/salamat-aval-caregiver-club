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
for (const marker of ['resolveLoggedInIdentity', 'model.name=identity.name', 'caregiverId', 'خوش آمدید', 'salamat-identity-changed']) {
  if (!dynamicIdentitySource.includes(marker)) throw new Error(`Dynamic identity marker missing: ${marker}`);
}
console.log('Logged-in user identity, profile linkage and personalized welcome syntax is valid.');

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

const securityWorkerSource = await readFile('preview/_worker.js', 'utf8');
for (const marker of ['PREVIEW_AUTH_ENABLED', 'PREVIEW_AUTH_USERNAME', 'PREVIEW_AUTH_PASSWORD', 'env.ASSETS.fetch', 'Content-Security-Policy']) {
  if (!securityWorkerSource.includes(marker)) throw new Error(`Security worker marker missing: ${marker}`);
}
new Function(securityWorkerSource.replace('export default {', 'return {'));
console.log('Cloudflare Pages security gateway syntax and required controls are valid.');
