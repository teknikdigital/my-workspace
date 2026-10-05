"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  CheckSquare,
  Activity,
  Layers,
  Link2,
  Users,
  Settings,
} from "lucide-react";

export default function WorkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { label: "Projects", href: "/work/projects", icon: Briefcase },
    { label: "Tasks", href: "/work/tasks", icon: CheckSquare },
    { label: "Activity", href: "/work/activity", icon: Activity },
    { label: "Applications", href: "/work/applications", icon: Layers },
    { label: "Resources", href: "/work/resources", icon: Link2 },
    { label: "Accounts", href: "/work/accounts", icon: Users },
    { label: "Settings", href: "/work/settings", icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {/* Work Sub-nav Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-full border border-line bg-glass p-1.5 backdrop-blur-md shadow-soft">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            pathname === tab.href ||
            (tab.href === "/work/projects" && pathname.startsWith("/work/projects/"));

          return (
            <Link
              key={tab.href}
              href={tab.href}
              id={`work-tab-${tab.label.toLowerCase()}`}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-200 select-none",
                isActive
                  ? "bg-teal text-white shadow-soft"
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
