import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { demoUsers } from "@/lib/domain";
import { createUserSchema } from "@/lib/validators";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        mobile: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: users, source: "database" });
  } catch {
    return NextResponse.json({ data: demoUsers, source: "demo" });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "اطلاعات کاربر معتبر نیست", errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const passwordHash = await hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: {
        fullName: parsed.data.fullName,
        mobile: parsed.data.mobile,
        username: parsed.data.username,
        passwordHash,
        role: parsed.data.role,
        status: parsed.data.status,
        permissionsJson: JSON.stringify(parsed.data.permissions),
      },
      select: {
        id: true,
        fullName: true,
        mobile: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای ناشناخته";
    return NextResponse.json(
      {
        message: "ثبت کاربر انجام نشد. ابتدا دیتابیس را با npm run db:push آماده کنید.",
        detail: message,
      },
      { status: 500 },
    );
  }
}
