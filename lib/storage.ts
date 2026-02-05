import { put } from "@vercel/blob";

/** 是否运行在 Vercel serverless 环境（文件系统只读） */
export const isVercel = !!process.env.VERCEL;

/** 是否配置了 Vercel Blob 存储 */
export const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;

/**
 * 保存图片：云端用 Vercel Blob，本地用文件系统
 * @param buffer 图片数据
 * @param filename 如 albums/xxx.jpg（Blob 用）或 xxx.jpg（本地用）
 */
export async function saveImage(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (token) {
    const blob = await put(filename, buffer, {
      access: "public",
      token,
    });
    return blob.url;
  }

  // Vercel 环境下文件系统只读，必须用 Blob 存储
  if (isVercel) {
    throw new Error(
      "Vercel 环境需要配置 Blob 存储。请在 Vercel 项目 → Storage → 创建 Blob Store，BLOB_READ_WRITE_TOKEN 会自动注入。"
    );
  }

  // 本地：写入 public/albums，filename 可能是 albums/xxx 或 xxx
  const baseName = filename.replace(/^albums\//, "");
  const { writeFile, mkdir } = await import("fs/promises");
  const path = await import("path");
  const publicDir = path.join(process.cwd(), "public", "albums");
  await mkdir(publicDir, { recursive: true });
  const filepath = path.join(publicDir, baseName);
  await writeFile(filepath, buffer);
  return `/albums/${baseName}`;
}
