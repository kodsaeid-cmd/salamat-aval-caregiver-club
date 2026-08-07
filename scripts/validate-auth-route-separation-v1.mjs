import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const worker = await readFile(new URL('../worker/index-referral-rewards.ts', import.meta.url), 'utf8');
const transition = await readFile(new URL('../preview/login-route-transition-v1.js', import.meta.url), 'utf8');
const panel = await readFile(new URL('../preview/panel-route-bootstrap-v1.js', import.meta.url), 'utf8');
const backend = await readFile(new URL('../preview/backend-integration.js', import.meta.url), 'utf8');
const authOverride = await readFile(new URL('../preview/backend-auth-override.js', import.meta.url), 'utf8');
const emailOverride = await readFile(new URL('../preview/backend-login-override.js', import.meta.url), 'utf8');

const workerMarkers = [
  'const PANEL_PATH = "/panel"',
  'const actor = await getUser(request, env)',
  'if (!actor) return redirectTo(request, "/")',
  'if (actor) return redirectTo(request, PANEL_PATH)',
  '.on("#loginView", new PanelLoginCompatibility())',
  '.on("#caregiverSignupLayer", new RemoveElement())',
  'headers.set("x-salamat-page-surface", "panel-only")',
  'login-route-transition-v1.js',
  'panel-route-bootstrap-v1.js',
  'const PANEL_ROUTE_VERSION = "1.3.0"',
  'data-salamat-panel-direct',
];
for (const marker of workerMarkers) assert.ok(worker.includes(marker), `Missing route-separation marker: ${marker}`);

for (const compatibilityMarker of [
  'class PanelLoginCompatibility',
  'data-salamat-panel-compat',
  'id="roleOptions"',
  'id="methodTabs"',
  'id="sendOtp"',
  'id="loginForm"',
]) assert.ok(worker.includes(compatibilityMarker), `Missing panel compatibility marker: ${compatibilityMarker}`);

assert.ok(worker.indexOf('LOGIN_TRANSITION_RUNTIME') < worker.indexOf('const tags: string[]'),'The login transition must be injected in the head before body runtimes.');
assert.ok(!worker.includes('AUTH_SURFACE_RUNTIME'), 'The old same-document auth surface runtime must not be injected.');
assert.ok(!worker.includes('.on("#appView"'), 'The panel shell must let the authenticated bootstrap open the app normally.');
assert.ok(!worker.includes('.on("#loginView", new RemoveElement())'), 'The panel shell must not delete legacy login hooks before app.js boots.');
assert.ok(!worker.includes('salamatPanelRouteSpin'),'Panel response must not contain a blocking route spinner.');

for (const marker of [
  "const PANEL_PATH='/panel'",
  "AUTH_PATHS=new Set(['/api/auth/login','/api/auth/verify-otp'])",
  'location.replace(PANEL_PATH)',
  'return new Promise(()=>{})',
]) assert.ok(transition.includes(marker), `Missing login transition marker: ${marker}`);

for (const marker of [
  "const VERSION='1.3.0'",
  "const PANEL_PATH='/panel'",
  'stabilizeCompatibilitySurface()',
  "login.style.setProperty('display','none','important')",
  "$('#caregiverSignupLayer')?.remove()",
  'window.SalamatStaffModuleRouter',
  'router.route(key)',
  "releasePanel('staff-route-dispatched')",
]) assert.ok(panel.includes(marker), `Missing panel document marker: ${marker}`);
assert.ok(!panel.includes("$('#loginView')?.remove()"), 'Panel bootstrap must preserve the invisible compatibility shell until legacy app startup is complete.');
assert.ok(!panel.includes('staff-shell-loading'),'Panel bootstrap must not replace the application with a preparing placeholder.');
assert.ok(!panel.includes('SalamatAccessControl?.openModule'),'Panel bootstrap must use the canonical staff module router.');

for (const marker of [
  "const PANEL_PATH='/panel'",
  "const LOGIN_PATH='/'",
  'if(payload?.data)location.replace(PANEL_PATH)',
  'location.replace(LOGIN_PATH)',
  'if(!panelRoute){location.replace(PANEL_PATH);return}',
  'if(error.status===401&&panelRoute){location.replace(LOGIN_PATH);return}',
]) assert.ok(backend.includes(marker), `Missing backend route marker: ${marker}`);
assert.ok(!backend.includes('await enterApp(payload.data)'), 'Login must never open the panel inside the login document.');

assert.ok(authOverride.includes('location.replace(PANEL_PATH)'), 'Primary auth override must navigate to /panel.');
assert.ok(emailOverride.includes('location.replace(PANEL_PATH)'), 'Email auth override must navigate to /panel.');
assert.ok(!authOverride.includes('location.reload()'), 'Primary auth override must not reload the login document.');
assert.ok(!emailOverride.includes('location.reload()'), 'Email auth override must not reload the login document.');

for (const obsolete of ['../preview/auth-surface-gate-v1.js','./validate-auth-surface-gate-v1.mjs']) {
  let exists = true;
  try { await access(new URL(obsolete, import.meta.url)); } catch { exists = false; }
  assert.equal(exists, false, `Obsolete same-document surface file still exists: ${obsolete}`);
}

console.log('Authentication route separation v1 contract is valid with direct non-blocking panel dashboard routing.');
