import fs from 'node:fs';
import { chromium } from 'playwright';

const [rawBaseUrl, metadataPath] = process.argv.slice(2);
const password = process.env.ADMIN_CORE_SMOKE_PASSWORD || '';
if (!rawBaseUrl || !metadataPath || !password) {
  throw new Error('Usage: ADMIN_CORE_SMOKE_PASSWORD=... node scripts/run-admin-ui-browser-smoke.mjs <base-url> <metadata-path>');
}

const baseUrl = rawBaseUrl.replace(/\/+$/, '');
const host = new URL(baseUrl).hostname;
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const rootUser = metadata.users?.root;
if (!rootUser?.username) throw new Error('Root smoke identity is missing from fixture metadata.');

const evidenceDir = '.admin-core-smoke';
fs.mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
const resultPath = `${evidenceDir}/browser-result.json`;
const failurePath = `${evidenceDir}/browser-failure.json`;
const screenshotPath = `${evidenceDir}/admin-router-v4.png`;
const failureScreenshotPath = `${evidenceDir}/admin-router-v4-failure.png`;

function expect(condition, message) {
  if (!condition) throw new Error(`Admin UI browser smoke failed: ${message}`);
}
function cookieFrom(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [];
  const raw = values[0] || response.headers.get('set-cookie') || '';
  const pair = raw.split(';')[0];
  const separator = pair.indexOf('=');
  return separator > 0 ? { name: pair.slice(0, separator), value: pair.slice(separator + 1) } : null;
}
async function waitForRouterRelease() {
  const deadline = Date.now() + 240_000;
  let last = 'no response';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/?browser-smoke=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
      });
      const html = await response.text();
      const headers = Object.fromEntries(response.headers.entries());
      if (response.status === 200
        && headers['x-salamat-caregiver-platform'] === '2.1.0'
        && headers['x-salamat-admin-router'] === '4.0.0'
        && html.includes('staff-module-router-v3.js?v=2.1.0')
        && !html.includes('panel-module-isolation-v2.js?v=2.1.0')) {
        return headers;
      }
      last = JSON.stringify({
        status: response.status,
        platform: headers['x-salamat-caregiver-platform'],
        router: headers['x-salamat-admin-router'],
        routerAsset: html.includes('staff-module-router-v3.js?v=2.1.0'),
        legacyAsset: html.includes('panel-module-isolation-v2.js?v=2.1.0'),
      });
    } catch (error) {
      last = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`Admin router v4 did not become ready: ${last}`);
}
async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ identifier: rootUser.username, password }),
  });
  const body = await response.json().catch(() => ({}));
  expect(response.status === 200, `admin login returned ${response.status}: ${JSON.stringify(body)}`);
  expect(body?.data?.role === 'ADMIN', `login role is ${body?.data?.role || 'unknown'}`);
  const cookie = cookieFrom(response);
  expect(cookie?.name === 'salamat_session' && cookie.value, 'login did not return salamat_session');
  return cookie;
}

const releaseHeaders = await waitForRouterRelease();
const sessionCookie = await login();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  locale: 'fa-IR',
  viewport: { width: 1600, height: 1000 },
});
await context.addCookies([{
  ...sessionCookie,
  domain: host,
  path: '/',
  secure: true,
  httpOnly: true,
  sameSite: 'Lax',
}]);
const page = await context.newPage();
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
});

const timings = {};
async function sidebarLabels() {
  return page.evaluate(() => [...document.querySelectorAll('#sidebarNav button')]
    .map((button) => button.textContent.trim())
    .filter(Boolean));
}
async function waitForMenuContract(timeout = 120_000) {
  const expected = ['حقوق و پرداخت', 'اعتبارات مالی', 'بانک آموزش', 'تنظیمات و لاگ'];
  const deadline = Date.now() + timeout;
  let lastLabels = [];
  while (Date.now() < deadline) {
    try {
      await page.evaluate(() => window.SalamatStaffModuleRouter?.reload?.());
    } catch {}
    await page.waitForTimeout(750);
    lastLabels = await sidebarLabels();
    if (expected.every((label) => lastLabels.includes(label))) return lastLabels;
    await page.waitForTimeout(4_250);
  }
  throw new Error(`Admin UI browser smoke failed: menu did not converge. Expected ${JSON.stringify(expected)}; actual ${JSON.stringify(lastLabels)}`);
}
async function clickModule(label, expectedTitle, expectedMarker, timeout = 20_000) {
  const button = page.locator('#sidebarNav button').filter({ hasText: label }).first();
  await button.waitFor({ state: 'visible', timeout });
  const started = Date.now();
  await button.click();
  await page.waitForFunction(({ title, marker }) => {
    const pageTitle = document.querySelector('#pageTitle')?.textContent?.trim() || '';
    const content = document.querySelector('#content')?.textContent || '';
    return pageTitle === title && content.includes(marker);
  }, { title: expectedTitle, marker: expectedMarker }, { timeout });
  timings[label] = Date.now() - started;
  expect(timings[label] < timeout, `${label} did not open within ${timeout}ms`);
}

try {
  const navigationResponse = await page.goto(`${baseUrl}/?ui-smoke=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  expect(navigationResponse?.status() === 200, `page navigation returned ${navigationResponse?.status()}`);
  expect(navigationResponse?.headers()['x-salamat-admin-router'] === '4.0.0', 'browser response is missing router v4 header');

  await page.waitForSelector('#appView:not(.hidden)', { timeout: 30_000 });
  await page.waitForFunction(() => window.SalamatStaffModuleRouter?.version === '4.0.0', null, { timeout: 30_000 });
  const convergedLabels = await waitForMenuContract();

  const iconAudit = await page.evaluate(() => [...document.querySelectorAll('#sidebarNav button')].map((button) => {
    const iconHost = button.querySelector(':scope > [data-icon]');
    const svg = iconHost?.querySelector('svg');
    const style = svg ? getComputedStyle(svg) : null;
    return {
      label: button.textContent.trim(),
      hasIconHost: Boolean(iconHost),
      directSvg: Boolean(button.querySelector(':scope > svg')),
      fill: style?.fill || '',
      stroke: style?.stroke || '',
    };
  }));
  expect(iconAudit.length >= 8, `only ${iconAudit.length} sidebar icons were found`);
  for (const icon of iconAudit) {
    expect(icon.hasIconHost, `${icon.label} is missing the original data-icon wrapper`);
    expect(!icon.directSvg, `${icon.label} contains a raw SVG child`);
    expect(icon.fill === 'none' || icon.fill === 'rgba(0, 0, 0, 0)', `${icon.label} fill is ${icon.fill}`);
    expect(icon.stroke && icon.stroke !== 'none', `${icon.label} has no line stroke`);
  }

  const mutationCount = await page.evaluate(() => new Promise((resolve) => {
    const nav = document.querySelector('#sidebarNav');
    let count = 0;
    const observer = new MutationObserver((records) => {
      count += records.filter((record) => record.type === 'childList').length;
    });
    observer.observe(nav, { childList: true, subtree: false });
    setTimeout(() => { observer.disconnect(); resolve(count); }, 2_500);
  }));
  expect(mutationCount <= 1, `sidebar rebuilt ${mutationCount} times while idle`);

  await clickModule('اعتبارات مالی', 'اعتبارات مالی', 'اعتبارات مالی مراقبین');
  await clickModule('حقوق و پرداخت', 'حقوق و پرداخت', 'حقوق و پرداخت مراقبین');
  await clickModule('بانک آموزش', 'بانک آموزش', 'مدیریت فایل‌ها، تخصیص آموزش و پایش مشاهده', 30_000);

  const usersButton = page.locator('#sidebarNav button').filter({ hasText: 'کاربران و دسترسی‌ها' }).first();
  await usersButton.click();
  const usersStarted = Date.now();
  await page.waitForFunction(() => {
    const workspace = document.querySelector('#acxWorkspace');
    return workspace && !workspace.classList.contains('acx-loading');
  }, null, { timeout: 30_000 });
  timings['کاربران و دسترسی‌ها'] = Date.now() - usersStarted;
  const usersState = await page.locator('#acxWorkspace').getAttribute('class');
  expect(!String(usersState).includes('acx-error'), 'users and access module returned an error');

  await page.screenshot({ path: screenshotPath, fullPage: true });
  expect(browserErrors.length === 0, `browser emitted errors: ${browserErrors.join(' | ')}`);

  const evidence = {
    adminRouter: '4.0.0',
    platformVersion: releaseHeaders['x-salamat-caregiver-platform'],
    nativeLineIconsRestored: true,
    rawSvgSidebarIcons: false,
    convergedLabels,
    idleSidebarMutations: mutationCount,
    moduleClicksPassed: ['اعتبارات مالی', 'حقوق و پرداخت', 'بانک آموزش', 'کاربران و دسترسی‌ها'],
    timingsMs: timings,
    browserErrors,
    verifiedAt: new Date().toISOString(),
  };
  fs.writeFileSync(resultPath, JSON.stringify(evidence, null, 2), { mode: 0o600 });
  console.log(`Admin UI browser smoke passed. Timings: ${JSON.stringify(timings)}`);
} catch (error) {
  const diagnostics = {
    message: error instanceof Error ? error.message : String(error),
    labels: await sidebarLabels().catch(() => []),
    pageTitle: await page.locator('#pageTitle').textContent().catch(() => ''),
    contentPreview: await page.locator('#content').textContent().then((value) => String(value || '').slice(0, 1000)).catch(() => ''),
    browserErrors,
    verifiedAt: new Date().toISOString(),
  };
  fs.writeFileSync(failurePath, JSON.stringify(diagnostics, null, 2), { mode: 0o600 });
  await page.screenshot({ path: failureScreenshotPath, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await context.close();
  await browser.close();
}
