import "../shared/job-ad-auto-points-runtime-v1";
import "../shared/job-ad-auto-points-v3-compat-v1";
import "../shared/job-ad-patient-points-v13";
import "../shared/job-ad-weekdays-runtime-v1";
// Compatibility owner invariant: ./admin-job-ads-v4 remains the underlying live module, wrapped only for 20-item pagination.
export {AdminJobAdsMobilePaginationV1 as AdminJobAdsMobileV3} from "./admin-job-ads-pagination-v1";
