import { z } from "zod";

const iranMobile = /^09\d{9}$/;

export const createUserSchema = z.object({
  fullName: z.string().min(3, "نام و نام خانوادگی الزامی است"),
  mobile: z.string().regex(iranMobile, "شماره موبایل معتبر نیست"),
  username: z.string().min(3).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد"),
  role: z.enum(["ADMIN", "OPERATIONS", "RECRUITER", "SUPPORT", "EVALUATOR", "EDUCATION", "HR"]),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  permissions: z.array(z.string()).default([]),
});

export const createCaregiverSchema = z.object({
  fullName: z.string().min(3, "نام و نام خانوادگی الزامی است"),
  mobile: z.string().regex(iranMobile, "شماره موبایل معتبر نیست"),
  birthDate: z.string().optional(),
  gender: z.string().optional(),
  maritalStatus: z.string().optional(),
  primaryType: z.enum(["ELDERLY", "PATIENT", "CHILD"]),
  skills: z.array(z.string()).default([]),
  workHistory: z.string().optional(),
  province: z.string().optional(),
  city: z.string().optional(),
  serviceRegion: z.string().optional(),
  acceptedShifts: z.array(z.string()).default([]),
  startAvailability: z.string().optional(),
  cooperationType: z.string().optional(),
  salaryExpectation: z.coerce.number().int().positive().optional(),
  saveAsDraft: z.boolean().default(false),
  recruiterId: z.string().min(1),
});
