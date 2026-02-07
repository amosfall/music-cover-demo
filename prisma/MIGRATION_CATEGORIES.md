# 分类功能数据库迁移

分类菜单依赖 `Category` 表以及 `AlbumCover.categoryId` 列。请执行以下命令同步数据库：

```bash
npx prisma db push
```

或使用迁移（推荐生产环境）：

```bash
npx prisma migrate dev --name add_categories
```

执行成功后，刷新页面即可使用完整分类功能（Default、Anpu/Deserts、Pink Floyd 及自定义分类）。
