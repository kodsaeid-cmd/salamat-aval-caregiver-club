import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash("123456", 10);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      fullName: "علی محمدی",
      mobile: "09121234567",
      username: "admin",
      passwordHash,
      role: "ADMIN",
      permissionsJson: JSON.stringify(["*"]),
    },
  });

  const recruiter = await prisma.user.upsert({
    where: { username: "recruiter" },
    update: {},
    create: {
      fullName: "مهدی رضایی",
      mobile: "09123334455",
      username: "recruiter",
      passwordHash,
      role: "RECRUITER",
      permissionsJson: JSON.stringify([
        "caregiver.create",
        "caregiver.read",
        "caregiver.update",
        "recruitment.report",
      ]),
    },
  });

  const operations = await prisma.user.upsert({
    where: { username: "operations" },
    update: {},
    create: {
      fullName: "سارا احمدی",
      mobile: "09125556677",
      username: "operations",
      passwordHash,
      role: "OPERATIONS",
      permissionsJson: JSON.stringify([
        "caregiver.read",
        "caregiver.approve",
        "evaluation.read",
      ]),
    },
  });

  await prisma.user.upsert({
    where: { username: "support" },
    update: {},
    create: {
      fullName: "ناهید کریمی",
      mobile: "09127778899",
      username: "support",
      passwordHash,
      role: "SUPPORT",
      status: "INACTIVE",
      permissionsJson: JSON.stringify(["ticket.read", "ticket.update"]),
    },
  });

  const caregivers = [
    {
      membershipCode: "SA-CG-1405-0001",
      fullName: "فاطمه احمدی",
      mobile: "09121110001",
      primaryType: "ELDERLY",
      skillsJson: JSON.stringify(["کمک به بهداشت", "کنترل علائم حیاتی"]),
      province: "تهران",
      city: "تهران",
      serviceRegion: "شمال تهران، سعادت‌آباد",
      acceptedShiftsJson: JSON.stringify(["MORNING", "FULL_TIME"]),
      recruitmentStage: "ACTIVE",
      professionalLevel: "PROFESSIONAL",
      professionalScore: 82,
      clubPoints: 745,
      licenseStatus: "VALID",
      active: true,
      recruiterId: recruiter.id,
    },
    {
      membershipCode: "SA-CG-1405-0002",
      fullName: "مریم جعفری",
      mobile: "09121110002",
      primaryType: "PATIENT",
      skillsJson: JSON.stringify(["مراقبت بیمار", "تزریقات"]),
      province: "تهران",
      city: "تهران",
      serviceRegion: "مرکز تهران",
      acceptedShiftsJson: JSON.stringify(["EVENING", "NIGHT"]),
      recruitmentStage: "EVALUATION",
      professionalLevel: "NEW",
      professionalScore: 0,
      clubPoints: 90,
      recruiterId: recruiter.id,
    },
    {
      membershipCode: "SA-CG-1405-0003",
      fullName: "زهرا موسوی",
      mobile: "09121110003",
      primaryType: "CHILD",
      skillsJson: JSON.stringify(["مراقبت کودک", "بازی و سرگرمی"]),
      province: "تهران",
      city: "تهران",
      serviceRegion: "غرب تهران",
      acceptedShiftsJson: JSON.stringify(["MORNING", "EVENING"]),
      recruitmentStage: "INITIAL_REVIEW",
      professionalLevel: "NEW",
      professionalScore: 0,
      clubPoints: 30,
      recruiterId: recruiter.id,
    },
  ];

  for (const caregiver of caregivers) {
    await prisma.caregiver.upsert({
      where: { membershipCode: caregiver.membershipCode },
      update: {},
      create: caregiver,
    });
  }

  await prisma.course.upsert({
    where: { code: "SA-CARE-101" },
    update: {},
    create: {
      title: "اصول مراقبت حرفه‌ای از سالمند",
      code: "SA-CARE-101",
      mandatory: true,
      credit: 10,
      description: "دوره پایه آشنایی با استانداردهای مراقبتی سلامت اول",
    },
  });

  console.log({ admin: admin.username, recruiter: recruiter.username, operations: operations.username });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
