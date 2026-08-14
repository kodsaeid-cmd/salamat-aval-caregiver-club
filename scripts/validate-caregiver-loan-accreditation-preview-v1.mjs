import fs from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),"utf8");
const preview=read("mobile-react/caregiver-loan-accreditation-preview-v1.tsx");
const wrapper=read("mobile-react/caregiver-benefits-v4.tsx");
const legacy=read("mobile-react/caregiver-benefits-v3.tsx");
const worker=read("worker/index-desktop-react-v1.ts");
const snapshot=read("scripts/data-safety-snapshot-v1.mjs");
const compare=read("scripts/compare-data-safety-snapshots-v1.mjs");

const slideCount=(preview.match(/className={`clap-slide /g)||[]).length;
const checks=[
 [slideCount===4,"caregiver loan preview contains exactly four slides"],
 [preview.includes("شما در حال اعتبارسنجی برای تخصیص وام هستید"),"preview states accreditation is in progress"],
 [preview.includes("/api/caregiver/platform/financial-profile")&&preview.includes("totalPoints"),"contract point counter reads canonical financial profile"],
 [[200,400,600,800].every(n=>preview.includes(String(n))),"preview shows only the four schematic point levels"],
 [!preview.includes("/credit-requests")&&!preview.includes('method:"POST"'),"preview cannot submit a caregiver loan request"],
 [!preview.includes("conic-gradient")&&!preview.includes("amountToman")&&!preview.includes("money(")&&!preview.includes("تومان"),"preview contains no live donut progress or loan amount"],
 [wrapper.includes("CaregiverLoanAccreditationPreviewV1")&&wrapper.includes("button:nth-child(1).active")&&wrapper.includes("cb4-loan-preview"),"loan tab is overridden by the accreditation preview"],
 [legacy.includes("function LoansTab")&&legacy.includes("/api/caregiver/platform/credit-requests"),"working stepped-loan UI remains preserved in source for later reactivation"],
 [worker.includes("routeLoanCreditPolicyV2")&&worker.includes("const loanResponse = await routeLoanCreditPolicyV2(request, env)"),"stepped-loan backend remains connected for continued development"],
 [snapshot.includes("contractPointRows")&&snapshot.includes("contractPointTotal")&&compare.includes("contractPointRows")&&compare.includes("contractPointTotal"),"contract point history remains protected by deploy data-safety snapshots"],
];
const failed=checks.filter(([ok])=>!ok);
for(const [ok,label] of checks)console.log(`${ok?"✓":"✗"} ${label}`);
if(failed.length)process.exit(1);
console.log("Caregiver loan accreditation preview contract validated.");
