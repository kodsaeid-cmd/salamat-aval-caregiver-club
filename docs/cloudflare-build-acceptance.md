# Cloudflare build acceptance gate

A change is not production-ready unless the Cloudflare Git Integration build for the exact head commit completes successfully.

Required evidence:

1. `npm clean-install` succeeds.
2. `npm run build` succeeds.
3. Wrangler deploy step starts and completes.
4. The build is associated with the exact pull-request head SHA.
5. GitHub CI success alone is not accepted as Cloudflare deployment evidence.
