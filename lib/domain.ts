export const roleLabels: Record<string, string> = {
  ADMIN: "ادمین سیستم",
  OPERATIONS: "مدیر عملیات",
  RECRUITER: "کاربر جذب",
  SUPPORT: "پشتیبان",
  EVALUATOR: "ارزیاب",
  EDUCATION: "کارشناس آموزش",
  HR: "منابع انسانی",
};

export const stageLabels: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  INITIAL_REVIEW: "بررسی اولیه",
  INTERVIEW: "تماس و مصاحبه",
  EVALUATION: "ارزیابی و تأیید",
  APPROVED: "تأییدشده",
  ACTIVE: "فعال‌سازی شده",
  REJECTED: "ردشده",
};

export const demoUsers = [
  {
    id: "u1",
    fullName: "علی محمدی",
    username: "admin",
    mobile: "09121234567",
    role: "ADMIN",
    status: "ACTIVE",
    createdAt: "1405/05/15",
  },
  {
    id: "u2",
    fullName: "سارا احمدی",
    username: "operations",
    mobile: "09125556677",
    role: "OPERATIONS",
    status: "ACTIVE",
    createdAt: "1405/05/20",
  },
  {
    id: "u3",
    fullName: "مهدی رضایی",
    username: "recruiter",
    mobile: "09123334455",
    role: "RECRUITER",
    status: "ACTIVE",
    createdAt: "1405/06/02",
  },
  {
    id: "u4",
    fullName: "ناهید کریمی",
    username: "support",
    mobile: "09127778899",
    role: "SUPPORT",
    status: "INACTIVE",
    createdAt: "1405/06/05",
  },
];

export const demoCaregivers = [
  {
    id: "c1",
    membershipCode: "SA-CG-1405-0001",
    fullName: "فاطمه احمدی",
    mobile: "09121110001",
    primaryType: "ELDERLY",
    recruitmentStage: "ACTIVE",
    professionalLevel: "PROFESSIONAL",
    professionalScore: 82,
    clubPoints: 745,
    active: true,
  },
  {
    id: "c2",
    membershipCode: "SA-CG-1405-0002",
    fullName: "مریم جعفری",
    mobile: "09121110002",
    primaryType: "PATIENT",
    recruitmentStage: "EVALUATION",
    professionalLevel: "NEW",
    professionalScore: 0,
    clubPoints: 90,
    active: false,
  },
  {
    id: "c3",
    membershipCode: "SA-CG-1405-0003",
    fullName: "زهرا موسوی",
    mobile: "09121110003",
    primaryType: "CHILD",
    recruitmentStage: "INITIAL_REVIEW",
    professionalLevel: "NEW",
    professionalScore: 0,
    clubPoints: 30,
    active: false,
  },
];

export function toPersianNumber(value: number | string) {
  return String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}
