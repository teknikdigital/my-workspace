import React from "react";
import { type LucideIcon, PlusCircle } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}

export function EmptyState({
  icon: Icon = PlusCircle,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-panel border border-dashed border-line bg-card/40 p-8 text-center sm:p-12">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal/10 text-teal mb-3">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-mute sm:text-sm">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-2 rounded-btn bg-teal px-4 py-2 text-xs font-semibold text-white shadow-soft hover:bg-teal-dark transition-all"
        >
          <PlusCircle className="h-4 w-4" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}
