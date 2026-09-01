import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const adapter = read('worker/database-backend-v1.ts');
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

console.log('Turso backend v1 contract passed: canonical Worker chain, D1 fallback, Turso adapter, guarded import and live cutover are wired.');
