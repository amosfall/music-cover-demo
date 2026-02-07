# 网易云 API 连接问题排查

当出现「无法连接网易云 API，请确认 NETEASE_API_URL 可访问」时，按以下步骤排查。

## 1. 运行诊断

在浏览器打开：

```
http://localhost:3000/api/check-netease
```

查看返回结果：
- `reachable: true` → 网络可达，问题可能出在具体接口
- `reachable: false` → 无法连接，继续下面步骤

## 2. 检查环境变量

确认 `.env.local` 中有 `NETEASE_API_URL`：

```bash
# 本地运行网易云 API 时（端口需与 Next.js 的 3000 不同）
NETEASE_API_URL=http://localhost:3002

# 或使用 Railway 等公网 API
NETEASE_API_URL=https://xxx-production.up.railway.app
```

修改后需**重启** `npm run dev`。

## 3. 方案 A：本地运行网易云 API（推荐）

1. **新开一个终端**，运行：
   ```bash
   PORT=3002 npx NeteaseCloudMusicApi
   ```
   或
   ```bash
   npx NeteaseCloudMusicApi
   ```
   （默认端口 3000，若与 Next.js 冲突需指定 `PORT=3002`）

2. 在 `.env.local` 中设置：
   ```
   NETEASE_API_URL=http://localhost:3002
   ```

3. 重启 Next.js 开发服务器

## 4. 方案 B：使用公网 API（Railway 等）

- **Railway 冷启动**：首次请求可能需 30–60 秒，请耐心重试
- **网络环境**：某些网络可能无法访问 Railway，可尝试本地方案 A
- 确认 Railway 服务已部署且 URL 正确

## 5. 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| `ECONNREFUSED` | 目标服务未启动 | 启动 NeteaseCloudMusicApi 或检查 Railway 服务 |
| `ETIMEDOUT` | 请求超时 | Railway 冷启动时多等一会；或换本地 API |
| `fetch failed` | 网络不通 | 检查防火墙、代理；尝试本地 API |
| `ENOTFOUND` | 域名无法解析 | 检查 NETEASE_API_URL 拼写 |
