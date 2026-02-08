# Clerk 登录配置指南

本项目使用 [Clerk](https://clerk.com) 保护 `/lyrics-wall` 路由，未登录用户访问时会被重定向到登录页。

## 1. 获取 API Keys

1. 打开 [Clerk Dashboard](https://dashboard.clerk.com)
2. 创建应用（或选择已有应用）
3. 进入 **API Keys** 页面
4. 复制以下两个值：
   - **Publishable key**（形如 `pk_test_xxx`）
   - **Secret key**（形如 `sk_test_xxx`）

## 2. 配置 .env.local

在项目根目录创建或编辑 `.env.local`，添加：

```env
# Clerk 登录（必填）
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_你的PublishableKey
CLERK_SECRET_KEY=sk_test_你的SecretKey
```

**注意：**

- `NEXT_PUBLIC_` 前缀的变量会暴露给浏览器，仅用于 Publishable key
- `CLERK_SECRET_KEY` 不要提交到 Git，已在 `.gitignore` 中忽略 `.env.local`

## 3. 可选：配置回调 URL

如需自定义登录/注册后跳转地址，可添加：

```env
CLERK_AFTER_SIGN_IN_URL=/lyrics-wall
CLERK_AFTER_SIGN_UP_URL=/lyrics-wall
```

默认为 `/lyrics-wall`。

## 4. 在 Clerk Dashboard 配置重定向

1. 进入 [Clerk Dashboard](https://dashboard.clerk.com) → 你的应用
2. 打开 **Paths** 或 **URLs** 设置
3. 设置 **Sign-in URL**：`/sign-in`
4. 设置 **Sign-up URL**：`/sign-up`
5. 设置 **After sign-in URL**：`/lyrics-wall`
6. 若本地开发，在 **Allowed redirect URLs** 中添加 `http://localhost:3000/lyrics-wall`

## 5. 使用方式

- **未登录**：访问 `/lyrics-wall` 时自动跳转到登录页
- **已登录**：可正常访问 `/lyrics-wall`
- **导航栏**：显示 `UserButton`，可查看个人信息、退出登录
- **未登录时**：导航栏显示「登录」按钮，点击打开登录弹窗
