# Backend foundation

This branch adds the first server-side foundation for the Caregiver Club using Cloudflare Workers and D1.

## Included

- `GET /api/health`
- `POST /api/internal/crm/caregivers/upsert`
- `GET /api/internal/caregivers`
- D1 schema for caregivers and CRM synchronization runs
- Bearer-token protection for internal integration endpoints
- Static asset fallback so the existing frontend can continue to be served by the same Worker

## First-time setup

```bash
npx wrangler d1 create salamat-aval-caregiver-club
cp wrangler.backend.example.toml wrangler.backend.toml
```

Put the returned D1 database ID in `wrangler.backend.toml`, then run:

```bash
npx wrangler d1 migrations apply salamat-aval-caregiver-club --remote --config wrangler.backend.toml
npx wrangler secret put CRM_SYNC_API_KEY --config wrangler.backend.toml
npx wrangler deploy --config wrangler.backend.toml
```

For local development:

```bash
npx wrangler d1 migrations apply salamat-aval-caregiver-club --local --config wrangler.backend.toml
npx wrangler dev --config wrangler.backend.toml
```

## CRM batch upsert

Maximum batch size is 500 caregivers.

```http
POST /api/internal/crm/caregivers/upsert
Authorization: Bearer <CRM_SYNC_API_KEY>
Content-Type: application/json
```

```json
{
  "caregivers": [
    {
      "crmRecordId": "8ab3c8c0-0000-0000-0000-000000000001",
      "membershipCode": "SA-100001",
      "nationalId": "0012345678",
      "fullName": "نمونه مراقب",
      "mobile": "+989121234567",
      "province": "تهران",
      "city": "تهران",
      "serviceRegion": "مرکز",
      "cooperationStatus": "ACTIVE",
      "crmModifiedOn": "2026-07-30T12:00:00Z",
      "active": true
    }
  ]
}
```

The API uses `crmRecordId` as the stable synchronization key and normalizes common Iranian mobile formats.

## Security boundary

The API key must only be stored in the internal CRM integration service and in Cloudflare Workers secrets. It must never be embedded in browser JavaScript or committed to the repository.
