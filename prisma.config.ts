import { config } from "dotenv";
// Next.js 项目的环境变量在 .env.local 中
config({ path: ".env.local" });
config({ path: ".env" }); // fallback

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
