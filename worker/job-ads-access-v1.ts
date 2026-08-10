// Compatibility shim only. Canonical job-ad authorization is enforced by
// worker/index-account-stability.ts and worker/job-ads-v1.ts through module ACL.
export async function rewriteJobAdsAccessResponse(_request:Request,response:Response){return response}
