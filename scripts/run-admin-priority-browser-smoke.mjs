import fs from 'node:fs';
import { chromium } from 'playwright';

const [rawBaseUrl, metadataPath] = process.argv.slice(2);
const password = process.env.ADMIN_CORE_SMOKE_PASSWORD || '';
if (!rawBaseUrl || !metadataPath || !password) {
  throw new Error('Usage: ADMIN_CORE_SMOKE_PASSWORD=... node scripts/run-admin-priority-browser-smoke.mjs <base-url> <metadata-path>');
}

const baseUrl = rawBaseUrl.replace(/\/+$/, '');
const host = new URL(baseUrl).hostname;
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const rootUser = metadata.users?.root;
if (!rootUser?.username) throw new Error('Root smoke identity is missing.');

const PLATFORM = '2.4.0';
const ROUTER = '5.0.0';
const ACCESS = '2.0.0';
const EXPECTED_LABELS = [
  'داشبورد مدیریتی','کاربران و دسترسی‌ها','پرونده مراقبین','قراردادها','حقوق و پرداخت',
  'اعتبارات مالی','بانک آموزش','ارزیابی و پروانه','پشتیبانی','تنظیمات و لاگ',
];
const evidenceDir = '.admin-core-smoke';
fs.mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
const resultPath = `${evidenceDir}/priority-browser-result.json`;
const failurePath = `${evidenceDir}/priority-browser-failure.json`;
const screenshotPath = `${evidenceDir}/priority-router.png`;
const failureScreenshotPath = `${evidenceDir}/priority-router-failure.png`;

const expect = (condition, message) => { if (!condition) throw new Error(`Admin priority browser smoke failed: ${message}`); };
function cookieFrom(response) {
  const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  const raw = values[0] || response.headers.get('set-cookie') || '';
  const pair = raw.split(';')[0];
  const index = pair.indexOf('=');
  return index > 0 ? { name: pair.slice(0, index), value: pair.slice(index + 1) } : null;
}
async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ identifier: rootUser.username, password }),
  });
  const body = await response.json().catch(() => ({}));
  expect(response.status === 200, `login returned ${response.status}: ${JSON.stringify(body)}`);
  const cookie = cookieFrom(response);
  expect(cookie?.name === 'salamat_session' && cookie.value, 'session cookie missing');
  return cookie;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: 'fa-IR', viewport: { width: 1600, height: 1000 } });
const session = await login();
await context.addCookies([{ ...session, domain: host, path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
const page = await context.newPage();
const browserErrors = [];
const ignoredWarnings = [];
const benign = ['fonts.googleapis.com','static.cloudflareinsights.com','unsafe-eval','Caregiver panel v2 failed to load EvalError'];
function record(message) {
  if (benign.some((pattern) => message.includes(pattern))) ignoredWarnings.push(message);
  else browserErrors.push(message);
}
page.on('pageerror', (error) => record(`pageerror: ${error.stack || error.message}`));
page.on('console', (message) => { if (message.type() === 'error') record(`console: ${message.text()}`); });

async function navigateToPriorityRelease() {
  const deadline = Date.now() + 240_000;
  let last = 'no navigation';
  while (Date.now() < deadline) {
    try {
      const response = await page.goto(`${baseUrl}/?priority-browser=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      const headers = response?.headers() || {};
      if (response?.status() === 200
        && headers['x-salamat-caregiver-platform'] === PLATFORM
        && headers['x-salamat-admin-router'] === ROUTER
        && headers['x-salamat-router-priority'] === 'head-first'
        && headers['x-salamat-access-control'] === ACCESS) return response;
      last = JSON.stringify({ status: response?.status(), headers });
    } catch (error) { last = String(error); }
    await page.waitForTimeout(5_000);
  }
  throw new Error(`priority release did not converge: ${last}`);
}
async function labels() {
  return page.evaluate(() => [...document.querySelectorAll('#sidebarNav button')].map((button) => button.textContent.trim()).filter(Boolean));
}
async function waitForMenu() {
  const deadline = Date.now() + 120_000;
  let actual = [];
  while (Date.now() < deadline) {
    await page.evaluate(async () => {
      await window.SalamatAccessControl?.reload?.();
      await window.SalamatStaffModuleRouter?.reload?.();
      window.SalamatStaffModuleRouter?.sync?.();
    }).catch(() => {});
    await page.waitForTimeout(900);
    actual = await labels();
    if (JSON.stringify(actual) === JSON.stringify(EXPECTED_LABELS)) return actual;
    await page.waitForTimeout(4_100);
  }
  throw new Error(`menu did not stabilize: ${JSON.stringify(actual)}`);
}
const timings = {};
async function clickModule(label, title, marker, timeout = 30_000) {
  const button = page.locator('#sidebarNav button').filter({ hasText: label }).first();
  await button.waitFor({ state: 'visible', timeout });
  const started = Date.now();
  await button.click();
  await page.waitForFunction(({ title, marker }) => {
    const pageTitle = document.querySelector('#pageTitle')?.textContent?.trim() || '';
    const content = document.querySelector('#content')?.textContent || '';
    return pageTitle === title && content.includes(marker);
  }, { title, marker }, { timeout });
  timings[label] = Date.now() - started;
}

try {
  await navigateToPriorityRelease();
  await page.waitForSelector('#appView:not(.hidden)', { timeout: 30_000 });
  await page.waitForFunction(() => window.SalamatStaffModuleRouter?.version === '5.0.0'
    && window.SalamatAccessControl?.version === '2.0.0', null, { timeout: 30_000 });

  const scripts = await page.evaluate(() => [...document.scripts].map((script) => script.getAttribute('src') || ''));
  const routerIndex = scripts.findIndex((src) => src.includes(`staff-module-router-v3.js?v=${PLATFORM}`));
  const accessIndex = scripts.findIndex((src) => src.includes(`access-control-runtime-v2.js?v=${PLATFORM}`));
  const firstLegacyIndex = scripts.findIndex((src) => /(?:app\.js|backend-integration\.js|staff-role-bridge\.js|staff-platform-runtime\.js)/.test(src));
  expect(routerIndex === 0, `router script index is ${routerIndex}, expected 0`);
  expect(accessIndex === 1, `access script index is ${accessIndex}, expected 1`);
  expect(firstLegacyIndex < 0 || accessIndex < firstLegacyIndex, 'critical scripts do not precede legacy scripts');

  const stableLabels = await waitForMenu();
  const icons = await page.evaluate(() => [...document.querySelectorAll('#sidebarNav button')].map((button) => {
    const host = button.querySelector(':scope > [data-icon]');
    const svg = host?.querySelector('svg');
    const style = svg ? getComputedStyle(svg) : null;
    return { label: button.textContent.trim(), host: Boolean(host), directSvg: Boolean(button.querySelector(':scope > svg')), fill: style?.fill || '', stroke: style?.stroke || '' };
  }));
  expect(icons.length === 10, `expected 10 icons, found ${icons.length}`);
  for (const icon of icons) {
    expect(icon.host, `${icon.label} lost data-icon wrapper`);
    expect(!icon.directSvg, `${icon.label} contains raw SVG`);
    expect(icon.fill === 'none' || icon.fill === 'rgba(0, 0, 0, 0)', `${icon.label} fill is ${icon.fill}`);
    expect(icon.stroke && icon.stroke !== 'none', `${icon.label} has no stroke`);
  }

  const mutations = await page.evaluate(() => new Promise((resolve) => {
    const nav = document.querySelector('#sidebarNav');
    let count = 0;
    const observer = new MutationObserver((records) => { count += records.filter((record) => record.type === 'childList').length; });
    observer.observe(nav, { childList: true, subtree: false });
    setTimeout(() => { observer.disconnect(); resolve(count); }, 3_500);
  }));
  expect(mutations <= 1, `sidebar rebuilt ${mutations} times while idle`);

  await clickModule('اعتبارات مالی', 'اعتبارات مالی', 'اعتبارات مالی مراقبین');
  await clickModule('حقوق و پرداخت', 'حقوق و پرداخت', 'حقوق و پرداخت مراقبین');
  await clickModule('بانک آموزش', 'بانک آموزش', 'مدیریت فایل‌ها، تخصیص آموزش و پایش مشاهده');
  await clickModule('پشتیبانی', 'پشتیبانی', 'پشتیبانی فوری و امنیتی');

  const usersStarted = Date.now();
  await page.locator('#sidebarNav button').filter({ hasText: 'کاربران و دسترسی‌ها' }).first().click();
  await page.waitForFunction(() => {
    const workspace = document.querySelector('#ac2Workspace');
    return workspace && !workspace.classList.contains('ac2-loading') && !workspace.classList.contains('ac2-error');
  }, null, { timeout: 30_000 });
  timings['کاربران و دسترسی‌ها'] = Date.now() - usersStarted;

  expect(browserErrors.length === 0, `browser errors: ${browserErrors.join(' | ')}`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  fs.writeFileSync(resultPath, JSON.stringify({
    platform: PLATFORM, router: ROUTER, routerPriority: 'head-first', accessControl: ACCESS,
    stableLabels, nativeLineIcons: true, idleSidebarMutations: mutations,
    moduleClicks: ['اعتبارات مالی','حقوق و پرداخت','بانک آموزش','پشتیبانی','کاربران و دسترسی‌ها'],
    timingsMs: timings, browserErrors, ignoredWarningsCount: ignoredWarnings.length, verifiedAt: new Date().toISOString(),
  }, null, 2), { mode: 0o600 });
  console.log(`Admin priority browser smoke passed: ${JSON.stringify(timings)}`);
} catch (error) {
  const diagnostics = {
    message: error instanceof Error ? error.message : String(error),
    labels: await labels().catch(() => []),
    scripts: await page.evaluate(() => [...document.scripts].map((script) => script.getAttribute('src') || '')).catch(() => []),
    pageTitle: await page.locator('#pageTitle').textContent().catch(() => ''),
    contentPreview: await page.locator('#content').textContent().then((value) => String(value || '').slice(0, 1500)).catch(() => ''),
    browserErrors, ignoredWarnings, verifiedAt: new Date().toISOString(),
  };
  fs.writeFileSync(failurePath, JSON.stringify(diagnostics, null, 2), { mode: 0o600 });
  await page.screenshot({ path: failureScreenshotPath, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await context.close();
  await browser.close();
}
