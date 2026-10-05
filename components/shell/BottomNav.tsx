"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Briefcase, User, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Beranda",
      href: "/",
      icon: Home,
      isActive: pathname === "/",
    },
    {
      label: "Work",
      href: "/work/projects",
      icon: Briefcase,
      isActive: pathname.startsWith("/work"),
    },
    {
      label: "Personal",
      href: "/personal/notes",
      icon: User,
      isActive: pathname.startsWith("/personal"),
    },
    {
      label: "Vault",
      href: "/vault",
      icon: ShieldCheck,
      isActive: pathname.startsWith("/vault"),
    },
    {
      label: "AI",
      href: "/ai",
      icon: Sparkles,
      isActive: pathname.startsWith("/ai"),
    },
  ];

  return (
    <nav
      aria-label="Navigasi Utama"
      className="fixed bottom-[max(14px,env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2"
    >
      <div className="flex items-center gap-1.5 rounded-full border border-line bg-glass px-2.5 py-2 backdrop-blur-[14px] shadow-pill">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          return (
            <Link
              key={item.href}
              href={item.href}
              id={`nav-${item.label.toLowerCase()}`}
              className={cn(
                "flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-all duration-200 select-none",
                active
                  ? "bg-gradient-to-r from-teal to-teal-dark text-white shadow-md"
                  : "text-mute hover:bg-card/70 hover:text-ink"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "")} />
              <span
                className={cn(
                  active ? "inline" : "hidden md:inline text-xs font-medium"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
