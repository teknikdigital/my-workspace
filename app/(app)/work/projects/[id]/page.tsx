import React from "react";
import { getProjectById, touchProjectLastOpened } from "@/lib/actions/projects";
import { ProjectDetailClient } from "./ProjectDetailClient";

export const revalidate = 0;

interface ProjectDetailPageProps {
  params: {
    id: string;
  };
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  // Touch last_opened_at
  await touchProjectLastOpened(params.id);

  const project = await getProjectById(params.id);

  return <ProjectDetailClient project={project} />;
}
