"use client";

import { useState, useRef, useEffect } from "react";
import { useClerk, useUser } from "@clerk/nextjs";

export default function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    user.primaryEmailAddress?.emailAddress ||
    "用户";

  const handleOpenEdit = () => {
    setNickname(user.firstName || user.username || "");
    setEditOpen(true);
    setOpen(false);
  };

  const handleSaveNickname = async () => {
    const value = nickname.trim();
    if (!value) return;
    setSaving(true);
    try {
      await user.update({ firstName: value });
      setEditOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAvatar = () => {
    setAvatarOpen(true);
    setOpen(false);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setAvatarSaving(true);
    try {
      await user.setProfileImage({ file });
      setAvatarOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setAvatarSaving(false);
      e.target.value = "";
    }
  };

  const handleLogout = () => {
    setOpen(false);
    signOut({ redirectUrl: "/" });
  };

  return (
    <div className="relative flex items-center tab-nav" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`tab-nav-btn flex items-center gap-2 ${open ? "active" : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {user.hasImage && user.imageUrl ? (
          <img
            src={user.imageUrl}
            alt=""
            className="h-6 w-6 shrink-0 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <span className="max-w-[160px] truncate sm:max-w-[200px]">{displayName}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-[var(--paper-dark)] bg-white py-1 shadow-lg"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleOpenEdit}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--ink)] hover:bg-[var(--paper-dark)]/30"
          >
            改昵称
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleOpenAvatar}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--ink)] hover:bg-[var(--paper-dark)]/30"
          >
            增加头像
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--ink-muted)] hover:bg-[var(--paper-dark)]/30 hover:text-[var(--ink)]"
          >
            退出
          </button>
        </div>
      )}

      {editOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => !saving && setEditOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[var(--paper-dark)] bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-sm font-medium text-[var(--ink)]">修改昵称</h3>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveNickname()}
              placeholder="输入昵称"
              className="mb-4 w-full rounded-lg border border-[var(--paper-dark)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-[var(--ink-muted)] hover:bg-[var(--paper-dark)]/30"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveNickname}
                disabled={saving || !nickname.trim()}
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {avatarOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => !avatarSaving && setAvatarOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[var(--paper-dark)] bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-sm font-medium text-[var(--ink)]">增加头像</h3>
            <p className="mb-4 text-xs text-[var(--ink-muted)]">选择一张图片作为头像，支持 JPG、PNG 等格式</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFileChange}
              className="mb-4 block w-full text-sm text-[var(--ink)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--paper-dark)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--ink)]"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setAvatarOpen(false)}
                disabled={avatarSaving}
                className="rounded-lg px-3 py-1.5 text-sm text-[var(--ink-muted)] hover:bg-[var(--paper-dark)]/30 disabled:opacity-50"
              >
                {avatarSaving ? "上传中…" : "取消"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
