"use client";

import React, { useTransition } from "react";
import type { Task } from "@/types/database";
import { toggleTaskStatus } from "@/lib/actions/tasks";
import { StatusBadge } from "@/components/ui/Badge";
import { Check, Calendar } from "lucide-react";
import { cn, formatDateIndo } from "@/lib/utils";

interface TaskItemRowProps {
  task: Task;
  onEdit?: (task: Task) => void;
}

export function TaskItemRow({ task, onEdit }: TaskItemRowProps) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      await toggleTaskStatus(task.id, task.status);
    });
  };

  const isDone = task.status === "done";

  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-3 rounded-btn border border-line bg-card/60 p-3 hover:bg-card transition-all",
        isDone && "opacity-60 bg-line/10"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          aria-label={isDone ? "Tandai belum selesai" : "Tandai selesai"}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all",
            isDone
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-mute hover:border-teal hover:bg-teal/10"
          )}
        >
          {isDone && <Check className="h-3.5 w-3.5 stroke-[3]" />}
        </button>

        <div className="min-w-0 cursor-pointer" onClick={() => onEdit?.(task)}>
          <p
            className={cn(
              "text-xs md:text-sm font-semibold text-ink truncate",
              isDone && "line-through text-mute"
            )}
          >
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-mute flex-wrap">
            {task.project && (
              <span className="font-semibold text-teal">{task.project.name}</span>
            )}
            {task.due_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDateIndo(task.due_date)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={task.priority} />
      </div>
    </div>
  );
}
