import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const expected = '2.4.0';
const checks = [
  ['worker/index-caregiver-platform-v1.ts', `const PLATFORM_VERSION = "${expected}"`],
  ['preview/staff-module-router-v3.js', `const ASSET_VERSION='${expected}'`],
  ['scripts/validate-caregiver-platform-v1.mjs', `const PLATFORM_VERSION = \\"${expected}\\"`],
  ['scripts/run-admin-priority-api-smoke.mjs', `const PLATFORM = '${expected}'`],
  ['scripts/run-admin-priority-browser-smoke.mjs', `const PLATFORM = '${expected}'`],
  ['worker/index-data-protection.ts', `caregiverPlatform: "${expected}"`],
];

for (const [path, needle] of checks) {
  const source = read(path);
  if (!source.includes(needle)) {
    throw new Error(`Platform version drift: ${path} is missing ${needle}`);
  }
}

console.log(`Platform version consistency passed for ${expected}.`);
