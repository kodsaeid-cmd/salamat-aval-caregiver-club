import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtime = await readFile(new URL('../preview/auth-surface-gate-v1.js', import.meta.url), 'utf8');
const worker = await readFile(new URL('../worker/index-referral-rewards.ts', import.meta.url), 'utf8');

const requiredRuntimeMarkers = [
  "const ROOT_CLASS='salamat-authenticated-surface'",
  "login.classList.add('hidden')",
  'login.hidden=true',
  "login.setAttribute('aria-hidden','true')",
  "login.style.setProperty('display','none','important')",
  "app.classList.remove('hidden')",
  'app.hidden=false',
  "video.pause()",
  "fetch('/api/auth/me'",
  "window.addEventListener('salamat-logged-out'",
  "window.addEventListener('salamat-access-ready'",
  'new MutationObserver(scheduleFromDom)',
];

for (const marker of requiredRuntimeMarkers) {
  assert.ok(runtime.includes(marker), `Missing auth surface marker: ${marker}`);
}

assert.ok(
  runtime.includes('body.salamat-login-visible #loginView.login-page.hidden'),
  'The hidden login surface must override the mobile login display rule.',
);
assert.ok(
  worker.includes('auth-surface-gate-v1.js') && worker.includes('x-salamat-auth-surface-gate'),
  'The top-level worker must inject and version the auth surface gate.',
);
assert.ok(
  worker.indexOf('referral-rewards-runtime-v1.js') < worker.indexOf('auth-surface-gate-v1.js'),
  'The auth surface gate must be the final top-level runtime.',
);

console.log('Authentication surface gate v1 contract is valid.');
