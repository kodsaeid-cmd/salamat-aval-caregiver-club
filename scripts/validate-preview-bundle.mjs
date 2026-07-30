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
if (!caregiverRegistrationSource.includes("role:'caregiver'") || !caregiverRegistrationSource.includes("status:'pending'")) {
  throw new Error('Self-registration must create a pending caregiver account.');
}
console.log('Caregiver self-registration and pending approval flow syntax is valid.');

const loginPageSource = await readFile('preview/index.html', 'utf8');
if (!loginPageSource.includes('openCaregiverRegistration') || !loginPageSource.includes('caregiverSignupForm')) {
  throw new Error('Caregiver registration entry point is missing from the login page.');
}
console.log('Caregiver registration entry point is present on the login page.');

const adminFunctionalSource = await readFile('preview/admin-functional.js', 'utf8');
new Function(adminFunctionalSource);
console.log('Functional admin workspace and dynamic caregiver identity syntax is valid.');
