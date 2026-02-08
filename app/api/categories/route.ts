import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";
import { getUserIdOrNull, getUserIdOr401 } from "@/lib/auth";

const DEFAULT_CATEGORY_NAME = "Default";
const DEMO_CATEGORIES = [
  { name: "Anpu/Deserts", sortOrder: 1 },
  { name: "Pink Floyd", sortOrder: 2 },
];

/** Ensure default + demo categories exist for user (idempotent) */
async function ensureCategoriesForUser(userId: string) {
  const existing = await prisma.category.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
  });
  if (existing.length > 0) return existing;

  const toCreate = [
    { name: DEFAULT_CATEGORY_NAME, sortOrder: 0, userId },
    ...DEMO_CATEGORIES.map((c) => ({ ...c, userId })),
  ];
  for (const c of toCreate) {
    await prisma.category.create({ data: c });
  }
  return prisma.category.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
  });
}

const FALLBACK_LIST = [
  { id: "all", name: "全部", sortOrder: 0 },
];

export async function GET() {
  const userId = await getUserIdOrNull();
  const userFilter = userId ? { userId } : { userId: null };

  try {
    const categories = await withDbRetry(async () => {
      const list = await prisma.category.findMany({
        where: userFilter,
        orderBy: { sortOrder: "asc" },
      });
      if (list.length === 0 && userId) {
        return ensureCategoriesForUser(userId);
      }
      return list;
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("[categories GET] Failed:", error);
    return NextResponse.json(
      { error: "获取分类失败", fallback: true, list: FALLBACK_LIST },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await getUserIdOr401();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const name = (body?.name as string)?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "分类名称不能为空" },
        { status: 400 }
      );
    }

    const maxOrder = await prisma.category
      .aggregate({ _max: { sortOrder: true }, where: { userId: authResult.userId } })
      .then((r) => r._max.sortOrder ?? -1);

    const category = await withDbRetry(() =>
      prisma.category.create({
        data: {
          name,
          sortOrder: maxOrder + 1,
          userId: authResult.userId,
        },
      })
    );
    return NextResponse.json(category);
  } catch (error) {
    console.error("Failed to create category:", error);
    return NextResponse.json(
      { error: "创建分类失败" },
      { status: 500 }
    );
  }
}
