import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { saveImage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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
    return NextResponse.json(
      { error: "上传失败" },
      { status: 500 }
    );
  }
}
