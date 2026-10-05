import React from "react";
import { getRecentActivities } from "@/lib/actions/activity";
import { getProjects } from "@/lib/actions/projects";
import { ActivityClient } from "./ActivityClient";

export const revalidate = 0;

export default async function ActivityPage() {
  const [activities, projects] = await Promise.all([
    getRecentActivities(30),
    getProjects(),
  ]);

  return (
    <ActivityClient
      initialActivities={activities}
      projects={projects}
    />
  );
}
