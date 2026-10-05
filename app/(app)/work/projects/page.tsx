import React from "react";
import { getProjects } from "@/lib/actions/projects";
import { ProjectsClient } from "./ProjectsClient";

export const revalidate = 0;

export default async function ProjectsPage() {
  const projects = await getProjects();
  return <ProjectsClient initialProjects={projects} />;
}
