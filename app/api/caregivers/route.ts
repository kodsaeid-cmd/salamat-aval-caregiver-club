import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { demoCaregivers } from "@/lib/domain";
import { createCaregiverSchema } from "@/lib/validators";

function buildMembershipCode(sequence: number) {
  return `SA-CG-1405-${String(sequence).padStart(4, "0")}`;
}

export async function GET() {
  try {
    const caregivers = await prisma.caregiver.findMany({
      select: {
        id: true,
        membershipCode: true,
        fullName: true,
        mobile: true,
        primaryType: true,
        recruitmentStage: true,
        professionalLevel: true,
        professionalScore: true,
        clubPoints: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: caregivers, source: "database" });
  } catch {
    return NextResponse.json({ data: demoCaregivers, source: "demo" });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createCaregiverSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "اطلاعات مراقب معتبر نیست", errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const count = await prisma.caregiver.count();
    const caregiver = await prisma.caregiver.create({
      data: {
        membershipCode: buildMembershipCode(count + 1),
        fullName: parsed.data.fullName,
        mobile: parsed.data.mobile,
        birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : undefined,
        gender: parsed.data.gender,
        maritalStatus: parsed.data.maritalStatus,
        primaryType: parsed.data.primaryType,
        skillsJson: JSON.stringify(parsed.data.skills),
        workHistory: parsed.data.workHistory,
        province: parsed.data.province,
        city: parsed.data.city,
        serviceRegion: parsed.data.serviceRegion,
        acceptedShiftsJson: JSON.stringify(parsed.data.acceptedShifts),
        startAvailability: parsed.data.startAvailability,
        cooperationType: parsed.data.cooperationType,
        salaryExpectation: parsed.data.salaryExpectation,
        recruitmentStage: parsed.data.saveAsDraft ? "DRAFT" : "INITIAL_REVIEW",
        recruiterId: parsed.data.recruiterId,
      },
    });

    return NextResponse.json({ data: caregiver }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای ناشناخته";
    return NextResponse.json(
      {
        message: "ثبت پروفایل انجام نشد. ابتدا دیتابیس را با npm run db:push آماده کنید.",
        detail: message,
      },
      { status: 500 },
    );
  }
}
