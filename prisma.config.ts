import { config } from "dotenv";
// Next.js 项目的环境变量在 .env.local 中
config({ path: ".env.local" });
config({ path: ".env" }); // fallback

import { defineConfig } from "prisma/config";

// 构建时（如 Docker/CI）可能没有 DATABASE_URL，用占位 URL 让 prisma generate 能通过；运行时会用真实环境变量
const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://build:build@localhost:5432/build?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
