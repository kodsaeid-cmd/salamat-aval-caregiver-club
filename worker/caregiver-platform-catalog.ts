import { MODULE_DEFINITIONS } from "./access-control";

const REMOVE_KEYS = new Set([
  "caregiver.rank",
  "caregiver.contracts",
  "caregiver.security",
]);

for (let index = MODULE_DEFINITIONS.length - 1; index >= 0; index -= 1) {
  if (REMOVE_KEYS.has(MODULE_DEFINITIONS[index].key)) MODULE_DEFINITIONS.splice(index, 1);
}

const wallet = MODULE_DEFINITIONS.find((module) => module.key === "caregiver.wallet");
if (wallet) {
  wallet.label = "کیف پول و اعتبارات";
  wallet.description = "پاداش معرفی پرونده، تسویه کیف پول و درخواست اعتبار";
}

const support = MODULE_DEFINITIONS.find((module) => module.key === "caregiver.support");
if (support) {
  support.label = "پشتیبانی";
  support.description = "پشتیبانی پرونده و پشتیبانی فوری و امنیتی";
}

const staffSupport = MODULE_DEFINITIONS.find((module) => module.key === "staff.support");
if (staffSupport) {
  staffSupport.label = "پشتیبانی";
  staffSupport.description = "گفت‌وگوی پرونده و صف فوری و امنیتی مراقبین";
}

if (!MODULE_DEFINITIONS.some((module) => module.key === "staff.financial_credits")) {
  const payrollIndex = MODULE_DEFINITIONS.findIndex((module) => module.key === "staff.payroll");
  MODULE_DEFINITIONS.splice(Math.max(0, payrollIndex + 1), 0, {
    key: "staff.financial_credits",
    panel: "STAFF",
    label: "اعتبارات مالی",
    icon: "wallet",
    description: "پاداش معرفی پرونده، تسویه کیف پول، اعتبار و حقوق مراقبین",
  });
}

export const CAREGIVER_PLATFORM_MODULE_CATALOG_VERSION = "1.0.0";
