#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", ".env.local");
const dest = path.join(__dirname, "..", ".env.export");

if (!fs.existsSync(src)) {
  console.error("未找到 .env.local");
  process.exit(1);
}
fs.copyFileSync(src, dest);
console.log("已导出到 .env.export（请勿提交，已在 .gitignore）");
