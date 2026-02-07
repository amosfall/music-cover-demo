# 🎵 专辑封面墙

上传音乐专辑封面，自动摆放成你的专属收藏墙。

## 功能

- **粘贴链接**：粘贴网易云歌曲/专辑链接，一键解析并添加
- **封面上传**：直接上传专辑封面图片
- **专辑信息**：记录专辑名、艺术家、发行年份、风格
- **自动摆放**：响应式网格布局，唱片墙效果

## 快速开始

```bash
npm install
npx prisma db push
npm run dev
```

## 网易云链接解析（粘贴链接功能）

出现「无法连接网易云 API」时，推荐使用**本地 API**（更稳定）：

1. **新开终端**，运行：`npm run netease-api` 或 `PORT=3002 npx NeteaseCloudMusicApi`
2. **在 `.env.local` 中配置**：`NETEASE_API_URL=http://localhost:3002`
3. **重启 Next.js**（Ctrl+C 后重新 `npm run dev`）

若使用 Railway 等公网 API，首次请求可能需等待 30–60 秒（冷启动）。  
页面底部可点击「检查 API 状态」诊断连接。

## 云端部署

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)，支持部署到 Vercel、Railway 等平台。

已配置 PostgreSQL 数据库，支持云端部署。
