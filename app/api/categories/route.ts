import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";

const DEFAULT_CATEGORY_NAME = "Default";
const DEMO_CATEGORIES = [
  { name: "Anpu/Deserts", sortOrder: 1 },
  { name: "Pink Floyd", sortOrder: 2 },
];

/** Ensure default + demo categories exist (idempotent) */
async function ensureCategories() {
  const existing = await prisma.category.findMany();
  if (existing.length > 0) return existing;

  const toCreate = [
    { name: DEFAULT_CATEGORY_NAME, sortOrder: 0 },
    ...DEMO_CATEGORIES,
  ];
  for (const c of toCreate) {
    await prisma.category.create({ data: c });
  }
  return prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
}

const FALLBACK_LIST = [
  { id: "all", name: "全部", sortOrder: 0 },
];

export async function GET() {
  try {
    const categories = await withDbRetry(async () => {
      const list = await prisma.category.findMany({
        orderBy: { sortOrder: "asc" },
      });
      if (list.length === 0) {
        return ensureCategories();
      }
      return list;
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json(
      { error: "获取分类失败", fallback: true, list: FALLBACK_LIST },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
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
      .aggregate({ _max: { sortOrder: true } })
      .then((r) => r._max.sortOrder ?? -1);

    const category = await withDbRetry(() =>
      prisma.category.create({
        data: {
          name,
          sortOrder: maxOrder + 1,
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
