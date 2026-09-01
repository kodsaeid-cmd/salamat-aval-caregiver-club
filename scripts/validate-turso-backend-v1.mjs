import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const adapter = read('worker/database-backend-v1.ts');
const lib = read('worker/lib.ts');
const contractRepair = read('worker/contract-production-repair-v1.ts');
const entry = read('worker/index-desktop-react-v1.ts');
const wrangler = read('wrangler.backend.jsonc');
const cutover = read('.github/workflows/turso-cutover.yml');

assert(adapter.includes('TURSO_DATABASE_URL'), 'Turso database URL is not wired.');
assert(adapter.includes('TURSO_AUTH_TOKEN'), 'Turso auth token is not wired.');
assert(adapter.includes('/v2/pipeline'), 'Turso SQL-over-HTTP pipeline is not used.');
assert(adapter.includes('prepare(sql: string)'), 'D1-compatible prepare() surface is missing.');
assert(adapter.includes('async batch('), 'D1-compatible batch() surface is missing.');
assert(adapter.includes('async first<'), 'D1-compatible first() surface is missing.');
assert(adapter.includes('async all<'), 'D1-compatible all() surface is missing.');
assert(adapter.includes('async run<'), 'D1-compatible run() surface is missing.');
assert(adapter.includes('async raw<'), 'D1-compatible raw() surface is missing.');
assert(adapter.includes('String(env?.DATABASE_BACKEND || D1_BACKEND)'), 'D1 must remain the safe default backend.');
assert(adapter.includes('TURSO_REQUEST_TIMEOUT_MS = 8_000'), 'Turso requests must have a bounded timeout.');
assert(adapter.includes('cachedTursoDatabase'), 'Turso database adapter must be reused inside warm Worker isolates.');
assert(adapter.includes('signal: controller.signal'), 'Turso request timeout is not attached to fetch().');
assert(lib.includes('String(env.DATABASE_BACKEND || "").trim().toLowerCase() === "turso"'), 'Turso must skip redundant runtime schema DDL after migration.');
const getUserBlock = lib.slice(lib.indexOf('export async function getUser'), lib.indexOf('export const staffRoles'));
assert(getUserBlock.indexOf('const token = cookies(request)[SESSION_COOKIE]') < getUserBlock.indexOf('await ensureSchema(env)'), 'Session cookie absence must be resolved before schema work.');
const prepareBlock = contractRepair.slice(contractRepair.indexOf('export async function prepareProductionContractRowsV1'), contractRepair.indexOf('export async function routeProductionContractRepairV1'));
assert(prepareBlock.includes('path!=="/api/staff/contracts-v2"&&!detail'), 'Contract repair GET path guard is missing.');
assert(prepareBlock.indexOf('path!=="/api/staff/contracts-v2"&&!detail') < prepareBlock.indexOf('const user=await getUser'), 'Unrelated GET requests must return before session lookup.');
assert(entry.includes('import { withDatabaseBackend } from "./database-backend-v1"'), 'Canonical Worker entry does not import database backend selection.');
const selections = entry.match(/env=withDatabaseBackend\(env\);/g) || [];
assert(selections.length === 3, 'Fetch, scheduled and queue paths must all select the database backend exactly once.');
assert(wrangler.includes('"main": "./worker/index-desktop-react-v1.ts"'), 'Canonical desktop Worker entrypoint must remain unchanged.');
assert(wrangler.includes('"binding": "DB"'), 'D1 fallback binding must remain during reversible cutover.');
assert(cutover.includes('MIGRATE_TO_TURSO'), 'Cutover lacks explicit destructive-action confirmation.');
assert(cutover.includes('Refuse to overwrite an existing Turso database'), 'Cutover overwrite guard is missing.');
assert(cutover.includes('TURSO_PLATFORM_API_TOKEN'), 'Cutover platform credential is missing.');
assert(cutover.includes('wrangler d1 export'), 'Cutover does not export D1 truth.');
assert(cutover.includes('database_upload'), 'Cutover does not provision an upload-seeded Turso database.');
assert(cutover.includes('TURSO_DATABASE_URL'), 'Cutover does not configure Worker database URL.');
assert(cutover.includes("printf '%s' 'turso' | npx wrangler secret put DATABASE_BACKEND"), 'Cutover does not atomically select Turso backend.');
assert(cutover.includes('__turso_cutover_probe__'), 'Cutover lacks a live auth-path database probe.');

console.log('Turso backend v1 contract passed: canonical Worker chain, D1 fallback, bounded remote latency, hot-path guards, guarded import and live cutover are wired.');