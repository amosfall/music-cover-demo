# 云端部署指南

## 方案一：Vercel 部署（推荐）

### 前置条件

- GitHub 账号
- [Vercel](https://vercel.com) 账号
- [Railway](https://railway.app) 账号（用于网易云 API）

---

### 步骤 1：准备数据库

Vercel 不支持 SQLite，需使用 PostgreSQL。

**选项 A：Vercel Postgres（与项目同账号）**

1. Vercel 控制台 → 你的项目 → **Storage** → **Create Database**
2. 选择 **Postgres** → 创建
3. 连接项目后，会得到 `POSTGRES_PRISMA_URL` 或 `DATABASE_URL`

**选项 B：Neon（免费）**

1. 打开 [Neon](https://neon.tech)，注册并创建项目
2. 复制连接字符串（如 `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`）

---

### 步骤 2：准备 Blob 存储

1. Vercel 项目 → **Storage** → **Create Store**
2. 选择 **Blob**
3. 创建后自动生成 `BLOB_READ_WRITE_TOKEN`

---

### 步骤 3：部署网易云 API（Railway）

1. 打开 [Railway](https://railway.app) → **New Project**
2. **Deploy from GitHub** → 选择 `Binaryify/NeteaseCloudMusicApi`
   - 或使用模板：在 GitHub 搜索 NeteaseCloudMusicApi，Fork 后连接 Railway
3. 部署完成后复制公网 URL，例如 `https://xxx-production.up.railway.app`

---

### 步骤 4：修改项目以支持云端

在**部署前**本地执行：

```bash
# 1. 使用 PostgreSQL 的 schema
cp prisma/schema.postgres.prisma prisma/schema.prisma

# 2. 使用 PostgreSQL 的 Prisma 客户端
cp lib/prisma.postgres.ts lib/prisma.ts

# 3. 生成 Prisma 客户端并迁移（替换为你的 DATABASE_URL）
DATABASE_URL="你的PostgreSQL连接串" npx prisma db push
```

---

### 步骤 5：配置环境变量

在 Vercel 项目 → **Settings** → **Environment Variables** 添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | `postgresql://...` | Postgres 连接串 |
| `BLOB_READ_WRITE_TOKEN` | 自动 | Vercel Blob 创建后自动注入 |
| `NETEASE_API_URL` | `https://xxx.railway.app` | 步骤 3 的 Railway 地址 |

---

### 步骤 6：部署到 Vercel

1. 将上述修改推送到 GitHub
2. [Vercel](https://vercel.com) → **Add New** → **Project** → 选择仓库
3. 确认环境变量已配置
4. 点击 **Deploy**

---

### 部署后：首次同步数据库（解决「分类功能需执行 npx prisma db push」）

若线上出现提示「分类功能需执行 npx prisma db push 后完整可用，当前仅显示全部专辑」，说明**生产环境数据库里还没有分类表**，需要在本机用**生产库连接串**执行一次同步：

1. 在 Vercel 项目 → **Settings** → **Environment Variables** 中复制 `DATABASE_URL` 的值（生产用 Postgres 连接串）。
2. 在项目根目录执行（把 `postgresql://...` 换成你复制的连接串，注意密码中的特殊字符要 URL 编码）：

```bash
DATABASE_URL="postgresql://用户:密码@主机:5432/库名?sslmode=require" npx prisma db push
```

或使用脚本（需先在当前终端设置环境变量）：

```bash
export DATABASE_URL="你的生产环境连接串"
npm run db:push
```

3. 执行成功后，刷新线上页面，分类功能即可正常使用。

若本次更新为数据库增加了新字段（如 `albumId`、`showOnLyricsWall` 等），同样需要再执行一次上述 `db push`。

---

## 方案二：Railway 一键部署

Railway 可同时运行 Next.js 和 PostgreSQL，无需拆分服务。

1. [Railway](https://railway.app) → **New Project**
2. **Add PostgreSQL**（数据库）
3. **Deploy from GitHub**（选择你的仓库）
4. 在 Next.js 服务中配置 `DATABASE_URL` 指向 PostgreSQL
5. 图片存储：可使用 Railway Volume，或接入 Cloudinary/S3

---

## 部署后检查

- 主应用可访问且能上传封面
- 粘贴网易云链接能解析并添加（需 NETEASE_API_URL 正确）
- 图片能正常显示（Blob 或对应存储）

---

## 常见问题

**Q: 本地开发还能用 SQLite 吗？**  
可以。部署前只在云端分支做上述修改，本地继续用 SQLite。或用 Neon 免费库在本地连 `DATABASE_URL` 开发。

**Q: 网易云 API 必须单独部署吗？**  
是的。Vercel 为 Serverless，不能长期跑 Node 服务，需在 Railway、Render 等平台单独部署 NeteaseCloudMusicApi。

---

## 排查清单（构建 / 运行问题）

| 现象 | 原因 | 处理 |
|------|------|------|
| **构建失败**：`PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL` | 在 Docker/CI 中执行 `npm ci` 时，`postinstall` 会跑 `prisma generate`，而当时未设置 `DATABASE_URL`。 | 项目已在 `prisma.config.ts` 中做占位：无 `DATABASE_URL` 时使用占位 URL，仅用于生成 Client，不连真实库。确保代码为最新并重新构建。若仍报错，检查部署平台是否在构建阶段注入了旧版配置或缓存。 |
| **线上提示**：「分类功能需执行 npx prisma db push 后完整可用」 | 生产库尚未执行过 schema 同步，缺少 `Category` 等表。 | 在本地用**生产环境**的 `DATABASE_URL` 执行一次：`DATABASE_URL="生产连接串" npx prisma db push`。详见上文「部署后：首次同步数据库」。 |
| **歌词墙一直「还没有歌词数据」** | 歌词墙数据来自：① 封面页通过链接抓取的**单曲**（带歌词）；② 歌词页手动添加的卡片。两者都没有则为空。 | 在封面页用底部胶囊粘贴网易云**单曲**链接抓取，或在「歌词」页点击「添加歌词」手动添加一条。 |
| **粘贴链接后添加失败 / 超时** | 未配置 `NETEASE_API_URL` 或自建网易云 API 未启动、被墙或限流。 | 在 Vercel 环境变量中配置 `NETEASE_API_URL` 指向自建 API（如 Railway 部署的 NeteaseCloudMusicApi）。可访问 `/api/check-netease` 做连通性检查。 |
| **图片不显示 / 上传失败** | 未配置 `BLOB_READ_WRITE_TOKEN` 或 Blob 未正确绑定项目。 | 在 Vercel → Storage → Blob 创建 Store 并绑定到项目，确保环境变量中有 `BLOB_READ_WRITE_TOKEN`。 |
