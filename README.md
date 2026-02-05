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

1. **新开终端**，运行：`PORT=3002 npx NeteaseCloudMusicApi`
2. **在 `.env.local` 中配置**：`NETEASE_API_URL=http://localhost:3002`
3. **重启 Next.js** 即可使用

## 云端部署

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)，支持部署到 Vercel、Railway 等平台。
