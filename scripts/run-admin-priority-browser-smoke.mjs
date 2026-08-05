import fs from 'node:fs';
import { chromium } from 'playwright';

const [requestedBaseUrl, metadataPath] = process.argv.slice(2);
const password = process.env.ADMIN_CORE_SMOKE_PASSWORD || '';
const ALLOWED_BASE_URL = 'https://salamatavalcaregivers.site';
if (!requestedBaseUrl || !metadataPath || !password) {
  throw new Error('Usage: ADMIN_CORE_SMOKE_PASSWORD=... node scripts/run-admin-priority-browser-smoke.mjs <base-url> <metadata-path>');
}
const normalizedRequestedBaseUrl = requestedBaseUrl.replace(/\/+$/, '');
if (normalizedRequestedBaseUrl !== ALLOWED_BASE_URL) {
  throw new Error(`Browser smoke target is not allowlisted: ${normalizedRequestedBaseUrl}`);
}

const baseUrl = ALLOWED_BASE_URL;
const host = 'salamatavalcaregivers.site';
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const rootUser = metadata.users?.root;
if (!rootUser?.username) throw new Error('Root smoke identity is missing.');

const PLATFORM = '2.4.0';
const ROUTER = '5.0.0';
const ACCESS = '2.0.0';
const CONTRACTS = '1.0.0';
const CONTRACT_OWNER = '2.0.0';
const SUPPORT = '3.0.0';
const SUPPORT_OWNER = '3.0.0';
const NOTIFICATIONS = '2.0.0';
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
        && headers['x-salamat-access-control'] === ACCESS
        && headers['x-salamat-contracts'] === CONTRACTS
        && headers['x-salamat-contract-route-owner'] === CONTRACT_OWNER
        && headers['x-salamat-support-runtime'] === SUPPORT
        && headers['x-salamat-support-route-owner'] === SUPPORT_OWNER
        && headers['x-salamat-support-unity'] === SUPPORT
        && headers['x-salamat-notifications-runtime'] === NOTIFICATIONS) return response;
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
  await page.waitForFunction(({ contractOwner, support, supportOwner, notifications }) => window.SalamatContractModulePriority?.version === contractOwner
    && window.SalamatContractModulePriority?.owner === 'window-capture'
    && window.SalamatStaffModuleRouter?.version === '5.0.0'
    && window.SalamatAccessControl?.version === '2.0.0'
    && window.SalamatStaffSupportRouteOwner?.version === supportOwner
    && window.SalamatStaffSupportRouteOwner?.owner === 'window-capture'
    && window.SalamatStaffSupport?.version === support
    && window.SalamatStaffSupport?.canonical === true
    && window.SalamatServerNotifications?.version === notifications,
  { contractOwner: CONTRACT_OWNER, support: SUPPORT, supportOwner: SUPPORT_OWNER, notifications: NOTIFICATIONS }, { timeout: 30_000 });

  const scripts = await page.evaluate(() => [...document.scripts].map((script) => script.getAttribute('src') || ''));
  const contractsPriorityIndex = scripts.findIndex((src) => src.includes(`contract-module-priority-v2.js?v=${PLATFORM}`));
  const legacyContractsPriorityIndex = scripts.findIndex((src) => src.includes('contract-module-priority-v1.js'));
  const routerIndex = scripts.findIndex((src) => src.includes(`staff-module-router-v3.js?v=${PLATFORM}`));
  const accessIndex = scripts.findIndex((src) => src.includes(`access-control-runtime-v2.js?v=${PLATFORM}`));
  const supportOwnerIndex = scripts.findIndex((src) => src.includes(`staff-support-route-owner-v3.js?v=${SUPPORT_OWNER}`));
  const directSupportIndex = scripts.findIndex((src) => src.includes(`staff-support-direct-runtime-v3.js?v=${SUPPORT}`));
  const notificationsIndex = scripts.findIndex((src) => src.includes(`server-notifications-runtime-v2.js?v=${NOTIFICATIONS}`));
  const legacySupportIndex = scripts.findIndex((src) => src.includes('staff-support-runtime-v1.js'));
  const legacyDirectSupportIndex = scripts.findIndex((src) => src.includes('staff-support-direct-runtime-v2.js'));
  const legacyNotificationsIndex = scripts.findIndex((src) => /server-notifications-runtime\.js(?:\?|$)/.test(src));
  const firstLegacyIndex = scripts.findIndex((src) => /(?:app\.js|backend-integration\.js|staff-role-bridge\.js|staff-platform-runtime\.js)/.test(src));
  expect(contractsPriorityIndex === 0, `contracts priority v2 script index is ${contractsPriorityIndex}, expected 0`);
  expect(legacyContractsPriorityIndex < 0, `legacy contracts priority remains at script index ${legacyContractsPriorityIndex}`);
  expect(routerIndex === 1, `router script index is ${routerIndex}, expected 1`);
  expect(accessIndex === 2, `access script index is ${accessIndex}, expected 2`);
  expect(firstLegacyIndex < 0 || accessIndex < firstLegacyIndex, 'critical scripts do not precede legacy scripts');
  expect(supportOwnerIndex >= 0 && directSupportIndex > supportOwnerIndex, 'support route owner does not precede support runtime');
  expect(notificationsIndex >= 0, 'notifications runtime v2 is missing from live HTML');
  expect(legacySupportIndex < 0, `legacy support runtime remains at script index ${legacySupportIndex}`);
  expect(legacyDirectSupportIndex < 0, `support runtime v2 remains at script index ${legacyDirectSupportIndex}`);
  expect(legacyNotificationsIndex < 0, `notifications runtime v1 remains at script index ${legacyNotificationsIndex}`);

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

  await clickModule('قراردادها', 'قراردادها', 'مدیریت قراردادهای مراقبین');
  await page.waitForFunction(() => window.SalamatStaffContracts?.version === '1.0.0', null, { timeout: 30_000 });
  await page.waitForSelector('#sctCaregiverSearch', { timeout: 30_000 });
  const firstCaregiver = page.locator('#sctCaregivers [data-sct-caregiver]').first();
  await firstCaregiver.waitFor({ state: 'visible', timeout: 30_000 });
  await firstCaregiver.click();
  await page.waitForFunction(() => {
    const button = document.querySelector('#sctNewContract');
    return button && !button.disabled;
  }, null, { timeout: 30_000 });
  await page.locator('#sctNewContract').click();
  await page.waitForSelector('#sctContractModal', { timeout: 10_000 });
  const contractForm = await page.evaluate(() => ({
    jalaliFields: document.querySelectorAll('#sctContractForm [data-sct-date]').length,
    weekdayOptions: document.querySelectorAll('#sctContractForm input[name="workDays"]').length,
    sameSubscriber: Boolean(document.querySelector('#sctContractForm input[name="recipientSameAsSubscriber"]')),
    nativeDateInputs: document.querySelectorAll('#sctContractForm input[type="date"]').length,
  }));
  expect(contractForm.jalaliFields === 4, `contract form has ${contractForm.jalaliFields} Jalali fields instead of 4`);
  expect(contractForm.weekdayOptions === 7, `contract form has ${contractForm.weekdayOptions} weekday options instead of 7`);
  expect(contractForm.sameSubscriber, 'same-as-subscriber option is missing');
  expect(contractForm.nativeDateInputs === 0, 'contract form still contains native Gregorian date inputs');
  await page.locator('#sctContractForm input[name="recipientSameAsSubscriber"]').check();
  expect(await page.locator('#sctRecipientSection').isHidden(), 'recipient fields were not hidden for same subscriber');
  await page.locator('#sctContractForm [data-sct-date] .sct-date-trigger').first().click();
  await page.waitForSelector('#sctContractForm .sct-date-pop:not([hidden]) [data-sct-jyear]', { timeout: 5_000 });
  expect(await page.locator('#sctContractForm .sct-date-pop:not([hidden]) [data-sct-jmonth]').count() === 1, 'Jalali month dropdown is missing');
  await page.locator('#sctContractModal [data-sct-close]').first().click();

  await clickModule('اعتبارات مالی', 'اعتبارات مالی', 'اعتبارات مالی مراقبین');
  await clickModule('حقوق و پرداخت', 'حقوق و پرداخت', 'حقوق و پرداخت مراقبین');
  await clickModule('بانک آموزش', 'بانک آموزش', 'مدیریت فایل‌ها، تخصیص آموزش و پایش مشاهده');
  await clickModule('پشتیبانی', 'پشتیبانی و امنیت', 'مرکز گفت‌وگوی پشتیبانی مراقبین');
  const supportWorkspace = await page.evaluate(() => ({
    version: document.querySelector('#content .sts3-root')?.dataset.supportUnityVersion || '',
    tabs: [...document.querySelectorAll('#content [data-sts3-filter]')].map((item) => item.textContent.trim()),
    owner: window.SalamatStaffSupportRouteOwner?.owner || '',
  }));
  expect(supportWorkspace.version === SUPPORT, `support workspace version is ${supportWorkspace.version}`);
  expect(supportWorkspace.tabs.length === 2, `support workspace has ${supportWorkspace.tabs.length} tabs instead of 2`);
  expect(supportWorkspace.tabs.some((value) => value.includes('پشتیبانی پرونده')), 'case support tab is missing');
  expect(supportWorkspace.tabs.some((value) => value.includes('پشتیبانی فوری و امنیتی')), 'urgent support tab is missing');
  expect(supportWorkspace.owner === 'window-capture', 'support route is not owned by window capture');

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
    contracts: CONTRACTS, contractRouteOwner: CONTRACT_OWNER, supportRuntime: SUPPORT,
    supportRouteOwner: SUPPORT_OWNER, notificationsRuntime: NOTIFICATIONS,
    stableLabels, nativeLineIcons: true, legacyContractOwner: false, contractOwner: 'window-capture',
    legacySupportRuntime: false, legacyNotificationsRuntime: false, directSupportRuntime: true,
    supportWorkspace, idleSidebarMutations: mutations, contractForm,
    moduleClicks: ['قراردادها','اعتبارات مالی','حقوق و پرداخت','بانک آموزش','پشتیبانی','کاربران و دسترسی‌ها'],
    timingsMs: timings, browserErrors, ignoredWarningsCount: ignoredWarnings.length, verifiedAt: new Date().toISOString(),
  }, null, 2), { mode: 0o600 });
  console.log(`Admin priority browser smoke passed: ${JSON.stringify(timings)}`);
} catch (error) {
  const diagnostics = {
    message: error instanceof Error ? error.message : String(error),
    labels: await labels().catch(() => []),
    scripts: await page.evaluate(() => [...document.scripts].map((script) => script.getAttribute('src') || '')).catch(() => []),
    contractRouteOwner: await page.evaluate(() => window.SalamatContractModulePriority || null).catch(() => null),
    supportRouteOwner: await page.evaluate(() => window.SalamatStaffSupportRouteOwner || null).catch(() => null),
    supportRuntime: await page.evaluate(() => window.SalamatStaffSupport || null).catch(() => null),
    notificationsRuntime: await page.evaluate(() => window.SalamatServerNotifications || null).catch(() => null),
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
