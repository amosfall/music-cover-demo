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

/** 内联占位图（灰底），不依赖外网，加载失败时 UI 会显示专辑名首字 */
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect fill="#e5e5e5" width="400" height="400"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888" font-size="48" font-family="sans-serif">♪</text></svg>');

/** 安溥、蛙池专辑数据（封面为占位图，可后续在应用内替换为真实封面） */
const SEED_ALBUMS = [
  // 安溥（张悬）
  {
    albumName: "神的游戏",
    artistName: "安溥",
    imageUrl: PLACEHOLDER_IMAGE,
    releaseYear: "2012",
    genre: "流行",
  },
  {
    albumName: "城市",
    artistName: "安溥",
    imageUrl: PLACEHOLDER_IMAGE,
    releaseYear: "2009",
    genre: "流行",
  },
  {
    albumName: "亲爱的我还不知道",
    artistName: "安溥",
    imageUrl: PLACEHOLDER_IMAGE,
    releaseYear: "2007",
    genre: "流行",
  },
  {
    albumName: "My Life Will…",
    artistName: "张悬",
    imageUrl: PLACEHOLDER_IMAGE,
    releaseYear: "2006",
    genre: "流行",
  },
  // 蛙池
  {
    albumName: "哑牛",
    artistName: "蛙池",
    imageUrl: PLACEHOLDER_IMAGE,
    releaseYear: "2021",
    genre: "摇滚",
  },
  {
    albumName: "蛙池 2020-2021",
    artistName: "蛙池",
    imageUrl: PLACEHOLDER_IMAGE,
    releaseYear: "2023",
    genre: "摇滚",
  },
];

async function main() {
  console.log("🌱 开始 seed：安溥、蛙池专辑…");

  // 确保有 Default 分类
  let defaultCategory = await prisma.category.findFirst({
    where: { name: "Default" },
  });
  if (!defaultCategory) {
    defaultCategory = await prisma.category.create({
      data: { name: "Default", sortOrder: 0 },
    });
    console.log("  ✓ 已创建分类 Default");
  }

  let created = 0;
  let skipped = 0;

  for (const album of SEED_ALBUMS) {
    const existing = await prisma.albumCover.findFirst({
      where: {
        albumName: album.albumName,
        artistName: album.artistName,
      },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.albumCover.create({
      data: {
        ...album,
        categoryId: defaultCategory.id,
      },
    });
    created++;
    console.log(`  ✓ ${album.artistName} - ${album.albumName}`);
  }

  console.log(`\n✅ Seed 完成：新增 ${created} 张，已存在跳过 ${skipped} 张。`);
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
