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
for (const marker of ['MAX_UPLOAD=200*1024*1024', 'admTrainingForm', 'admEvalCare', 'globalNotificationPanel', 'ایمیل سازمانی (نام کاربری)']) {
  if (!featureUpgradesSource.includes(marker)) throw new Error(`Feature upgrade marker missing: ${marker}`);
}
console.log('Admin upload, caregiver search, email login and notification upgrades syntax is valid.');

const loginPageSource = await readFile('preview/index.html', 'utf8');
for (const marker of ['openCaregiverRegistration', 'caregiverSignupForm', 'feature-upgrades.js', 'ایمیل سازمانی / نام کاربری', 'تشکیل پروفایل و ارسال درخواست عضویت']) {
  if (!loginPageSource.includes(marker)) throw new Error(`Login and registration marker missing: ${marker}`);
}
console.log('Caregiver registration entry point and expanded profile form are present on the login page.');

const adminFunctionalSource = await readFile('preview/admin-functional.js', 'utf8');
new Function(adminFunctionalSource);
console.log('Functional admin workspace and dynamic caregiver identity syntax is valid.');
