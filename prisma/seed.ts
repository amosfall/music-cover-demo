import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL 未设置，请配置 .env.local 或环境变量");
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/** 占位图（data URL）；前端识别后直接渲染内联 SVG，不发起请求 */
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect fill="#e5e5e5" width="400" height="400"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888" font-size="48" font-family="sans-serif">♪</text></svg>');

/** Default 分类的原始专辑；seed 时会尝试从网易云 API 拉取真实封面（已从 Default 移除「神的游戏」安溥，仅保留在 Anpu/Deserts） */
const DEFAULT_ALBUMS = [
  { albumName: "城市", artistName: "安溥", releaseYear: "2009", genre: "流行", searchKeywords: "安溥 城市" },
  { albumName: "亲爱的我还不知道", artistName: "安溥", releaseYear: "2007", genre: "流行", searchKeywords: "安溥 亲爱的我还不知道" },
  { albumName: "My Life Will…", artistName: "张悬", releaseYear: "2006", genre: "流行", searchKeywords: "张悬 My Life Will" },
  { albumName: "哑牛", artistName: "蛙池", releaseYear: "2021", genre: "摇滚", searchKeywords: "蛙池 哑牛" },
  { albumName: "蛙池 2020-2021", artistName: "蛙池", releaseYear: "2023", genre: "摇滚", searchKeywords: "蛙池 2020" },
];

/** Anpu/Deserts 分类的张悬四张专辑（未登录可见）；seed 时会尝试从网易云 API 拉取真实封面 */
const ANPU_ALBUMS = [
  { albumName: "亲爱的...我还不知道", artistName: "张悬", releaseYear: "2007", genre: "流行", searchKeywords: "张悬 亲爱的我还不知道" },
  { albumName: "城市", artistName: "张悬", releaseYear: "2009", genre: "流行", searchKeywords: "张悬 城市" },
  { albumName: "神的游戏", artistName: "张悬", releaseYear: "2012", genre: "流行", searchKeywords: "张悬 神的游戏" },
  { albumName: "Original", artistName: "张悬", releaseYear: "2014", genre: "流行", searchKeywords: "张悬 Original" },
];

type AlbumHit = { name?: string; picUrl?: string; artist?: { name?: string }; artists?: { name?: string }[] };

/** 从网易云 API 搜索专辑并返回封面 URL；可传专辑名/歌手做匹配，避免拉错（如「神的游戏」误匹配到「游京」） */
async function fetchNeteaseCover(
  keywords: string,
  options?: { expectedAlbumName?: string; expectedArtist?: string }
): Promise<string | null> {
  const base = process.env.NETEASE_API_URL?.replace(/\/$/, "");
  if (!base) return null;
  try {
    const res = await fetch(`${base}/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=10&limit=15`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: { albums?: AlbumHit[] } };
    const albums = data?.result?.albums ?? [];
    const albumName = options?.expectedAlbumName?.trim();
    const artistParts = options?.expectedArtist?.trim().split(/\s*[,、]\s*/).filter(Boolean) ?? [];

    for (const al of albums) {
      const name = (al.name ?? "").trim();
      const artistName = (al.artist?.name ?? al.artists?.[0]?.name ?? "").trim();
      if (albumName && !name.includes(albumName) && !albumName.includes(name)) continue;
      if (artistParts.length > 0 && !artistParts.some((p) => artistName.includes(p) || name.includes(p))) continue;
      const pic = al.picUrl;
      if (pic) return String(pic).replace(/^http:/, "https:");
    }
    const first = albums[0]?.picUrl;
    return first ? String(first).replace(/^http:/, "https:") : null;
  } catch {
    return null;
  }
}

function isPlaceholderImage(url: string): boolean {
  return !url || url.startsWith("data:image/svg") || url.includes("placehold.");
}

async function main() {
  console.log("🌱 开始 seed：Default + Anpu/Deserts（均尝试拉取真实封面）…");

  const hasNetease = !!process.env.NETEASE_API_URL?.trim();
  if (hasNetease) console.log("  📷 网易云 API 已配置，将拉取真实专辑封面");

  // 1. Default 分类：新建时拉封面；已存在且仍是占位图则更新封面
  let defaultCategory = await prisma.category.findFirst({
    where: { name: "Default", userId: null },
  });
  if (!defaultCategory) {
    defaultCategory = await prisma.category.create({
      data: { name: "Default", sortOrder: 0 },
    });
    console.log("  ✓ 已创建分类 Default");
  }
  // 从 Default 中移除「神的游戏」安溥（封面易拉错，仅在 Anpu/Deserts 保留张悬版）
  const removed = await prisma.albumCover.deleteMany({
    where: {
      userId: null,
      albumName: "神的游戏",
      artistName: "安溥",
      categoryId: defaultCategory.id,
    },
  });
  if (removed.count > 0) console.log(`  ✓ 已从 Default 移除「神的游戏」安溥（${removed.count} 张）`);
  for (const album of DEFAULT_ALBUMS) {
    const { searchKeywords, ...rest } = album;
    let imageUrl = PLACEHOLDER_IMAGE;
    if (hasNetease && searchKeywords) {
      const artistFilter = album.artistName === "安溥" ? "安溥,张悬" : album.artistName;
      const pic = await fetchNeteaseCover(searchKeywords, {
        expectedAlbumName: album.albumName,
        expectedArtist: artistFilter,
      });
      if (pic) imageUrl = pic;
    }
    const existing = await prisma.albumCover.findFirst({
      where: { albumName: album.albumName, artistName: album.artistName, userId: null },
    });
    if (existing) {
      const shouldUpdate =
        imageUrl !== PLACEHOLDER_IMAGE &&
        (imageUrl !== existing.imageUrl || isPlaceholderImage(existing.imageUrl));
      if (shouldUpdate) {
        await prisma.albumCover.update({
          where: { id: existing.id },
          data: { imageUrl },
        });
        console.log(`  ✓ Default: ${album.artistName} - ${album.albumName}（已更新封面）`);
      } else {
        console.log(`  ✓ Default: ${album.artistName} - ${album.albumName}（已存在）`);
      }
    } else {
      await prisma.albumCover.create({
        data: { ...rest, imageUrl, categoryId: defaultCategory.id },
      });
      console.log(`  ✓ Default: ${album.artistName} - ${album.albumName}${imageUrl !== PLACEHOLDER_IMAGE ? "（已拉取封面）" : ""}`);
    }
  }

  // 2. Anpu/Deserts 分类（未登录可见，张悬四张专辑）
  let anpuCategory = await prisma.category.findFirst({
    where: { name: "Anpu/Deserts", userId: null },
  });
  if (!anpuCategory) {
    anpuCategory = await prisma.category.create({
      data: { name: "Anpu/Deserts", sortOrder: 1 },
    });
    console.log("  ✓ 已创建分类 Anpu/Deserts");
  }
  // 先清除该分类下旧专辑，再插入新的（含真实封面，若网易云 API 可用）
  const deletedAnpu = await prisma.albumCover.deleteMany({
    where: { categoryId: anpuCategory.id, userId: null },
  });
  if (deletedAnpu.count > 0) console.log(`  ✓ 已清除 Anpu/Deserts 下 ${deletedAnpu.count} 张旧专辑`);

  if (hasNetease) console.log("  📷 正在从网易云 API 拉取 Anpu/Deserts 张悬专辑封面…");

  for (const album of ANPU_ALBUMS) {
    const { searchKeywords, ...rest } = album;
    let imageUrl = PLACEHOLDER_IMAGE;
    if (hasNetease && searchKeywords) {
      const pic = await fetchNeteaseCover(searchKeywords, {
        expectedAlbumName: album.albumName,
        expectedArtist: album.artistName,
      });
      if (pic) {
        imageUrl = pic;
        console.log(`  ✓ Anpu/Deserts: ${album.artistName} - ${album.albumName}（已拉取封面）`);
      } else {
        console.log(`  ✓ Anpu/Deserts: ${album.artistName} - ${album.albumName}（使用占位图）`);
      }
    } else {
      console.log(`  ✓ Anpu/Deserts: ${album.artistName} - ${album.albumName}`);
    }
    await prisma.albumCover.create({
      data: { ...rest, imageUrl, categoryId: anpuCategory.id },
    });
  }

  console.log("\n✅ Seed 完成：Default 与 Anpu/Deserts 专辑封面已更新（需 NETEASE_API_URL 拉取真实图）。");
}

main()
  .catch((e) => {
    console.error("❌ Seed 失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
