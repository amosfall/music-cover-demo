// 云端 PostgreSQL 用 - 通过 pg Pool + @prisma/adapter-pg 连接 Neon
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  pool: Pool;
};

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  // Neon 需使用 Pooled 连接串（host 含 -pooler 或 ?pgbouncer=true），否则易出现连接意外终止
  if (connectionString.includes("neon.tech") && !connectionString.includes("pooler") && !connectionString.includes("pgbouncer")) {
    console.warn("[prisma] 检测到 Neon 直连，建议使用 Pooled 连接串（控制台 Copy connection string -> Pooled）");
  }

  const pool = new Pool({
    connectionString,
    max: 5, // Neon 免费版最多支持少量并发
    idleTimeoutMillis: 30_000, // 空闲 30s 后释放连接（避免被 Neon 强杀）
    connectionTimeoutMillis: 10_000, // 获取连接超时 10s
  });

  // 处理 Pool 级别的连接异常，防止进程崩溃
  pool.on("error", (err) => {
    console.error("pg Pool: unexpected error on idle client", err.message);
  });

  return pool;
}

function createPrismaClient(pool: Pool) {
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const pool = globalForPrisma.pool ?? createPool();
export const prisma = globalForPrisma.prisma ?? createPrismaClient(pool);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool;
  globalForPrisma.prisma = prisma;
}
