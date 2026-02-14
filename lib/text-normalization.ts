import * as OpenCC from 'opencc-js';

// 初始化转换器（简体 -> 繁体，繁体 -> 简体）
const s2t = OpenCC.Converter({ from: 'cn', to: 'hk' });
const t2s = OpenCC.Converter({ from: 'hk', to: 'cn' });

/**
 * 规范化文本：
 * 1. 移除首尾空格
 * 2. 转换为简体中文 (以确保简繁体被视为相同)
 * 3. 转换为小写 (处理英文大小写)
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  
  // 1. 基本清理
  let cleaned = text.trim().toLowerCase();
  
  // 2. 简繁转换 (统一转为简体)
  try {
    cleaned = t2s(cleaned);
  } catch (e) {
    // 如果转换失败，降级使用原始文本
    console.warn("OpenCC conversion failed for:", text);
  }
  
  return cleaned;
}
