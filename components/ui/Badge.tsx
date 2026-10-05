import React from "react";
import { cn, getStatusBadgeClass, getStatusLabelIndo } from "@/lib/utils";

interface BadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: BadgeProps) {
  const badgeClass = getStatusBadgeClass(status);
  const text = label || getStatusLabelIndo(status);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide capitalize",
        badgeClass,
        className
      )}
    >
      {text}
    </span>
  );
}
