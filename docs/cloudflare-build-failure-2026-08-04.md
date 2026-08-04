# Cloudflare build failure — 2026-08-04

## Exact failure

Cloudflare Workers Build stopped during `npm run build` in:

```text
scripts/validate-caregiver-platform-v1.mjs
Error: worker wrapper: missing const PLATFORM_VERSION = "2.3.0"
```

## Root cause

The head-first router branch intentionally bumped the Worker platform version to `2.4.0`, while two pre-existing contracts still expected `2.3.0`:

- `preview/staff-module-router-v3.js` → `ASSET_VERSION`
- `scripts/validate-caregiver-platform-v1.mjs` → Worker and Router assertions

The production API and smoke scripts already expected `2.4.0`, so the repository contained version drift.

## Resolution

The Worker, Router asset loader, public version endpoint, API smoke, browser smoke and Cloudflare build validator now all require `2.4.0`.

The build validator also checks the head-first router contract so a future version drift fails before merge.

## Acceptance

This issue is not considered resolved until the actual Cloudflare Git Integration build succeeds on the corrected commit. GitHub CI or Wrangler dry-run alone is insufficient evidence.
