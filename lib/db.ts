/**
 * 数据库连接类错误识别与重试，应对云数据库（如 Neon）空闲断连。
 */

export function isDbConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code;
  return (
    code === "P1017" ||
    code === "P1001" ||
    msg.includes("Connection terminated unexpectedly") ||
    msg.includes("connection closed") ||
    msg.includes("Server has closed the connection") ||
    msg.includes("ECONNRESET") ||
    msg.includes("connect ETIMEDOUT") ||
    msg.includes("Connection refused") ||
    msg.includes("Can't reach database server")
  );
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

/**
 * 执行 fn，若失败且为连接类错误则指数退避重试（最多 3 次）。
 * 延迟：500ms → 1000ms → 2000ms
 */
export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isDbConnectionError(err) || attempt === MAX_RETRIES) throw err;
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(
        `[db-retry] 连接错误，第 ${attempt + 1}/${MAX_RETRIES} 次重试，等待 ${delay}ms...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
