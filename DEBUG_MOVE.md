# 移入歌单功能排查指南

## 1. Schema 检查

- **AlbumCover** 模型已有 `categoryId` 和 `category` 关联（见 `prisma/schema.prisma`）
- 执行以下命令确保数据库与 Schema 同步：

```bash
npx prisma db push
```

若提示无法连接，请检查网络或 Neon 控制台项目状态。

---

## 2. 右键菜单与请求逻辑

点击「移入歌单」时会：

1. 调用 `handleMoveToCategory(albumName, targetCategoryId)`
2. 对当前分类中同名专辑发起多个 `PUT /api/albums/[id]`，body 为 `{ categoryId: targetCategoryId }`

**浏览器控制台日志**（F12 → Console）：
- `[移入歌单] 发起请求:` — 包含 albumName、targetCategoryId、albumIds
- `[移入歌单] 成功:` 或 `[移入歌单] 请求失败:` — 请求结果

**Network 面板**：确认是否有 `PUT /api/albums/xxx` 请求，以及状态码和 Response。

---

## 3. 后端日志

**开发终端**（运行 `npm run dev` 的终端）会打印：

- `[albums PUT] 收到请求:` — 收到的 id、bodyKeys、categoryId
- `[albums PUT] Prisma 更新成功:` — 更新后的 categoryId、albumName
- `[albums PUT] 更新失败:` 或 `解析 body 失败:` — 错误信息

若**完全没有**上述日志 → 请求未到达后端（前端或路由问题）。  
若有「收到请求」但「更新失败」→ 检查错误信息和数据库连接。

---

## 4. Neon 连接串

若使用 Neon，请使用 **Pooled** 连接串：

- 在 Neon 控制台：Copy connection string → 选择 **Pooled**
- 连接串中 host 通常包含 `-pooler`（例如 `ep-xxx-pooler.xxx.neon.tech`）

当前项目已配置检测：若使用直连会输出警告。
