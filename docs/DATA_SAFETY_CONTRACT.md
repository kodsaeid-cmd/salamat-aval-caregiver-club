# Data Safety Contract — Salamat Aval Caregiver Club

Version: 1.0

## Purpose
UI, React bundles, mobile/desktop redesigns and route changes are disposable presentation layers. They must never be the source of truth for user identity, caregiver identity, evaluations, contract points, wallet money, credits, loans, contracts or permissions.

## Canonical sources of truth
- Accounts and roles: `users` plus Access Control tables.
- Caregiver identity/profile: `caregivers` and related server-side profile tables.
- Evaluation history: `caregiver_evaluation_periods` and `caregiver_evaluation_scores`.
- Contract points: `caregiver_contract_point_ledger`.
- Wallet: `caregiver_wallet_transactions`.
- Credit/loan workflow: `caregiver_credit_requests` and server-side benefit rules.
- Contracts: `contracts`.
- Job applications: `care_job_applications`.

Frontend state, `localStorage`, `sessionStorage` and IndexedDB must not become canonical storage for these domains.

## Production release contract
Every production deployment follows this order and fails closed on any failed step:

1. Static Data Safety validation.
2. Successful encrypted remote D1 backup.
3. Pre-migration production integrity snapshot.
4. Pending migration inspection.
5. Additive migration apply.
6. Post-migration integrity snapshot and no-loss comparison.
7. Worker/static asset deployment.
8. Post-deploy integrity snapshot and no-loss comparison.
9. Existing live health and schema verification.

## Migration policy
Beginning with migration `0105`, normal production migrations may add tables, columns, indexes, triggers and constraints but may not contain destructive SQL such as `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE FROM`, or table replacement/rename patterns.

A destructive data operation requires a separate maintenance process, explicit review, a tested restore plan and a fresh encrypted backup. It must not be smuggled into a normal UI/application release.

## Append-only financial and point history
`caregiver_wallet_transactions` and `caregiver_contract_point_ledger` are immutable ledgers. Existing entries cannot be updated or deleted. Corrections are new compensating entries so the audit history remains complete.

## Hard-delete protection
Normal production operation cannot hard-delete:
- users,
- caregivers,
- finalized evaluation periods,
- credit request history,
- contracts.

Use account status, soft-delete fields, workflow statuses or a corrective historical record instead.

## Integrity snapshot rules
Protected metrics are compared before migrations, after migrations and after deployment. Live traffic may legitimately add records during deployment, therefore protected metrics are monotonic: they may stay equal or increase, but must not decrease.

Protected metrics include account/caregiver counts, finalized evaluation count, contract-point ledger rows and total, wallet transaction rows and credit/debit totals, credit requests, contracts and job applications.

A decrease fails the production release.

## Recovery rule
If any integrity check fails:
1. Stop further production writes/deploy investigation.
2. Preserve the generated before/after evidence.
3. Retrieve the encrypted pre-deploy D1 backup artifact.
4. Identify the migration or application write that caused the loss.
5. Validate a restore in a non-production environment first.
6. Restore production only through an explicitly reviewed recovery operation.

Never compensate for unknown loss by manually guessing balances, scores or points.

## UI redesign acceptance test
A UI redesign is considered data-safe only if the old frontend can be replaced entirely and, after login, the same server-side account, profile, evaluations, points, wallet history, credits, contracts, job applications and permissions reappear without migration of browser state.
