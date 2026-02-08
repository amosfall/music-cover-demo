import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { saveImage, isVercel, hasBlobToken } from "@/lib/storage";
import { getUserIdOr401 } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authResult = await getUserIdOr401();
  if (authResult instanceof NextResponse) return authResult;

  // 在 Vercel 上必须有 Blob 存储才能上传文件
  if (isVercel && !hasBlobToken) {
    return NextResponse.json(
      {
        error:
          "请先在 Vercel 项目中配置 Blob 存储（项目 → Storage → 创建 Blob Store），BLOB_READ_WRITE_TOKEN 会自动注入。",
      },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image") as File;
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "请选择图片文件" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `albums/${randomUUID()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const imageUrl = await saveImage(Buffer.from(arrayBuffer), filename);

    return NextResponse.json({
      imageUrl,
      success: true,
    });
  } catch (error) {
    console.error("Upload error:", error);
    const msg = error instanceof Error ? error.message : "上传失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
