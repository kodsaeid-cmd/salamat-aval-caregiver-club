import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const requireText = (source, needle, label) => {
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
};

const wrangler = read('wrangler.backend.jsonc');
const strictAccess = read('worker/strict-access.ts');
const accountManagement = read('worker/account-management-v2.ts');
const entry = read('worker/index-account-stability.ts');
const guard = read('preview/staff-permission-guard.js');

requireText(wrangler, 'index-account-stability.ts', 'strict worker entrypoint');
requireText(strictAccess, 'explicitUserValue !== undefined && explicitUserValue !== null', 'explicit false permission precedence');
requireText(strictAccess, 'modules.filter((module) => module.actions.view)', 'view-only module projection');
requireText(accountManagement, 'add("username", username)', 'username/email update');
requireText(accountManagement, "status='DELETED'", 'safe account deletion');
requireText(accountManagement, 'DELETE FROM sessions WHERE user_id=?', 'session revocation');
requireText(entry, 'strictRequireAccess', 'strict server-side permission gate');
requireText(entry, "permissions_json='[]'", 'legacy permission cleanup');
requireText(guard, 'button.remove()', 'unauthorized navigation removal');
requireText(guard, 'input.removeAttribute(\'readonly\')', 'editable legacy identifier');

console.log('Strict module visibility and legacy account management contracts are valid.');
