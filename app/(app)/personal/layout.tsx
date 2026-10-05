"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FileText,
  FolderArchive,
  Bookmark,
  Bell,
  UserCheck,
} from "lucide-react";

export default function PersonalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { label: "Notes", href: "/personal/notes", icon: FileText },
    { label: "Documents", href: "/personal/documents", icon: FolderArchive },
    { label: "Links", href: "/personal/links", icon: Bookmark },
    { label: "Reminders", href: "/personal/reminders", icon: Bell },
    { label: "Personal Accounts", href: "/personal/accounts", icon: UserCheck },
  ];

  return (
    <div className="space-y-6">
      {/* Personal Sub-nav Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-full border border-line bg-glass p-1.5 backdrop-blur-md shadow-soft">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              id={`personal-tab-${tab.label.toLowerCase()}`}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-200 select-none",
                isActive
                  ? "bg-purple-600 text-white shadow-soft"
                  : "text-mute hover:bg-card/70 hover:text-ink"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      <div>{children}</div>
    </div>
  );
}
