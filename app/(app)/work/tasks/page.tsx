import React from "react";
import { getTasks } from "@/lib/actions/tasks";
import { getProjects } from "@/lib/actions/projects";
import { getApplications } from "@/lib/actions/applications";
import { TasksClient } from "./TasksClient";

export const revalidate = 0;

export default async function TasksPage() {
  const [tasks, projects, applications] = await Promise.all([
    getTasks(),
    getProjects(),
    getApplications(),
  ]);

  return (
    <TasksClient
      initialTasks={tasks}
      projects={projects}
      applications={applications}
    />
  );
}
