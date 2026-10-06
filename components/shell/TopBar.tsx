"use client";

import React, { useEffect, useState } from "react";
import { signOut } from "@/lib/actions/auth";
import { Search, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import Image from "next/image";

interface TopBarProps {
  displayName?: string | null;
  roleLabel?: string | null;
  email?: string | null;
}

export function TopBar({ displayName, roleLabel, email }: TopBarProps) {
  const [timeStr, setTimeStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  const name = displayName || (email ? email.split("@")[0] : "Owner");
  const role = roleLabel || "Owner";
  const initials = name.slice(0, 2).toUpperCase();

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      setDateStr(
        now.toLocaleDateString("id-ID", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const openSearch = () => {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);
  };

  return (
    <header className="sticky top-[10px] z-40 mx-auto w-full max-w-6xl px-4 pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center justify-between gap-2 rounded-full border border-line bg-glass px-3.5 py-1.5 backdrop-blur-[14px] shadow-soft transition-all md:px-5">
        {/* Left: Logo & App Name */}
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-ink">
          <div className="relative h-8 w-8 shrink-0">
            <Image
              src="/logomyworkspace.png"
              alt="Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="hidden sm:inline text-base font-extrabold tracking-tight">
            My Workspace
          </span>
        </Link>

        {/* Center: Search / Command Palette Trigger */}
        <button
          id="global-search-trigger"
          type="button"
          onClick={openSearch}
          className="flex flex-1 max-w-md items-center justify-between gap-2 rounded-full border border-line bg-card/60 px-3.5 py-1.5 text-xs text-mute hover:border-teal/50 hover:bg-card transition-all sm:text-sm"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="h-4 w-4 text-teal shrink-0" />
            <span className="truncate">Cari apa saja...</span>
          </span>
          <kbd className="hidden rounded bg-line px-1.5 py-0.5 text-[10px] font-semibold text-mute md:inline-block">
            Ctrl K
          </kbd>
        </button>

        {/* Right: User Info, Time, Theme Toggle, Sign Out */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Ganti tema"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card/60 text-ink hover:bg-card transition-all"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-orange" />
              ) : (
                <Moon className="h-4 w-4 text-teal" />
              )}
            </button>
          )}

          {/* User Badge */}
          <div className="flex items-center gap-2">
            <div
              title={`${name} (${role})`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-teal/10 border border-teal/20 text-xs font-bold text-teal"
            >
              {initials}
            </div>
            <div className="hidden lg:flex flex-col text-left text-xs leading-tight">
              <span className="font-semibold text-ink truncate max-w-[110px]">{name}</span>
              <span className="text-[10px] text-mute">{role}</span>
            </div>
          </div>

          {/* Clock & Date (Desktop) */}
          <div className="hidden md:flex flex-col text-right text-xs leading-tight border-l border-line pl-3">
            <span className="font-bold text-ink">{timeStr || "--:--"}</span>
            <span className="text-[10px] text-mute">{dateStr}</span>
          </div>

          {/* Sign Out Button */}
          <form action={signOut}>
            <button
              type="submit"
              title="Keluar"
              className="hidden sm:flex items-center gap-1.5 rounded-full border border-line bg-card/60 px-3 py-1.5 text-xs font-semibold text-ink hover:border-red/40 hover:bg-red/10 hover:text-red transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Keluar</span>
            </button>
            <button
              type="submit"
              title="Keluar"
              className="flex sm:hidden h-8 w-8 items-center justify-center rounded-full border border-line bg-card/60 text-mute hover:text-red"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
