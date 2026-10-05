import React from "react";
import { getApplications } from "@/lib/actions/applications";
import { getProjects } from "@/lib/actions/projects";
import { ApplicationsClient } from "./ApplicationsClient";

export const revalidate = 0;

export default async function ApplicationsPage() {
  const [applications, projects] = await Promise.all([
    getApplications(),
    getProjects(),
  ]);

  return (
    <ApplicationsClient
      initialApplications={applications}
      projects={projects}
    />
  );
}
