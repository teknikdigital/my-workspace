"use client";

import React, { useState } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDateIndo } from "@/lib/utils";
import Link from "next/link";
import {
  Briefcase,
  Layers,
  Link2,
  Users,
  CheckSquare,
  FileText,
  ExternalLink,
  ArrowLeft,
  Database,
  GitBranch,
  Globe,
  Sparkles,
} from "lucide-react";

interface ProjectDetailClientProps {
  project: any;
}

export function ProjectDetailClient({ project }: ProjectDetailClientProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "resources" | "applications" | "accounts" | "tasks" | "notes"
  >("overview");

  if (!project) {
    return (
      <div className="py-12 text-center text-mute">
        <p>Project tidak ditemukan.</p>
        <Link href="/work/projects" className="mt-4 inline-block text-teal font-semibold hover:underline">
          Kembali ke daftar project
        </Link>
      </div>
    );
  }

  const applications = project.applications || [];
  const projectResources = project.project_resources || [];
  const projectAccounts = project.project_accounts || [];
  const tasks = project.tasks || [];
  const notes = project.notes || [];

  // Key relationships
  const databaseResources = projectResources.filter((pr: any) => pr.role === "database");
  const repoResources = projectResources.filter((pr: any) => pr.role === "repository");
  const deployResources = projectResources.filter((pr: any) => pr.role === "deployment");

  const tabs = [
    { id: "overview", label: "Overview", icon: Briefcase, count: null },
    { id: "resources", label: "Resources", icon: Link2, count: projectResources.length },
    { id: "applications", label: "Applications", icon: Layers, count: applications.length },
    { id: "accounts", label: "Accounts", icon: Users, count: projectAccounts.length },
    { id: "tasks", label: "Tasks", icon: CheckSquare, count: tasks.length },
    { id: "notes", label: "Notes", icon: FileText, count: notes.length },
  ];

  return (
    <div className="space-y-6">
      {/* Back Link & Header */}
      <div>
        <Link
          href="/work/projects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-mute hover:text-teal transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Projects</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
                {project.name}
              </h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-xs sm:text-sm text-mute max-w-2xl">
              {project.description || "Tidak ada deskripsi tambahan."}
            </p>
          </div>

          {/* Quick Access Action */}
          <div className="flex items-center gap-2">
            {projectResources.length > 0 && (
              <div className="relative group">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-btn bg-gradient-to-r from-teal to-teal-dark px-4 py-2 text-xs font-bold text-white shadow-soft hover:opacity-95"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Quick Access</span>
                </button>

                {/* Dropdown with Quick Access Links */}
                <div className="absolute right-0 mt-2 hidden group-hover:block w-64 rounded-panel border border-line bg-card p-2 shadow-soft z-30">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-mute px-2 py-1">
                    Resource Tautan Cepat
                  </div>
                  {projectResources.map((pr: any) => (
                    <a
                      key={pr.resource_id}
                      href={pr.resources?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs text-ink hover:bg-teal/10 hover:text-teal transition-all"
                    >
                      <span className="truncate">{pr.resources?.title}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-mute" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Segmented Control Sub-tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-line pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-teal text-white shadow-sm"
                  : "bg-card/50 text-mute hover:bg-card hover:text-ink"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-line text-mute"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Architectural Relationships Overview */}
            <div className="lg:col-span-2 space-y-6">
              {/* Relationship Summary Card */}
              <div className="rounded-panel border border-line bg-glass p-6 backdrop-blur-sm shadow-soft space-y-4">
                <h3 className="text-base font-bold text-ink flex items-center gap-2">
                  <Database className="h-4 w-4 text-teal" />
                  <span>Struktur & Hubungan Arsitektur</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  {/* Database */}
                  <div className="rounded-btn border border-line bg-card/60 p-3.5">
                    <span className="text-[10px] font-bold uppercase text-mute">Database Utama</span>
                    <div className="mt-1 font-bold text-ink text-sm">
                      {databaseResources.length > 0 ? (
                        databaseResources.map((db: any) => (
                          <a
                            key={db.resource_id}
                            href={db.resources?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal hover:underline flex items-center gap-1 mt-0.5 truncate"
                          >
                            <span>{db.resources?.title}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ))
                      ) : (
                        <span className="text-mute text-xs font-normal">Belum ditautkan</span>
                      )}
                    </div>
                  </div>

                  {/* Repository */}
                  <div className="rounded-btn border border-line bg-card/60 p-3.5">
                    <span className="text-[10px] font-bold uppercase text-mute">Repository</span>
                    <div className="mt-1 font-bold text-ink text-sm">
                      {repoResources.length > 0 ? (
                        repoResources.map((repo: any) => (
                          <a
                            key={repo.resource_id}
                            href={repo.resources?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal hover:underline flex items-center gap-1 mt-0.5 truncate"
                          >
                            <GitBranch className="h-3 w-3 shrink-0" />
                            <span>{repo.resources?.title}</span>
                          </a>
                        ))
                      ) : (
                        <span className="text-mute text-xs font-normal">Belum ditautkan</span>
                      )}
                    </div>
                  </div>

                  {/* Deployment */}
                  <div className="rounded-btn border border-line bg-card/60 p-3.5">
                    <span className="text-[10px] font-bold uppercase text-mute">Deployment URL</span>
                    <div className="mt-1 font-bold text-ink text-sm">
                      {deployResources.length > 0 ? (
                        deployResources.map((dp: any) => (
                          <a
                            key={dp.resource_id}
                            href={dp.resources?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal hover:underline flex items-center gap-1 mt-0.5 truncate"
                          >
                            <Globe className="h-3 w-3 shrink-0" />
                            <span>{dp.resources?.title}</span>
                          </a>
                        ))
                      ) : (
                        <span className="text-mute text-xs font-normal">Belum ditautkan</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress & Tech Stack Panel */}
              <div className="rounded-panel border border-line bg-glass p-6 backdrop-blur-sm shadow-soft space-y-4">
                <h3 className="text-base font-bold text-ink">Progress & Teknologi</h3>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-ink">
                    <span>Kelengkapan Sistem</span>
                    <span>{project.progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-line overflow-hidden">
                    <div
                      className="h-full bg-teal transition-all"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                {project.tech_stack && project.tech_stack.length > 0 && (
                  <div className="pt-2">
                    <span className="text-xs font-semibold text-mute block mb-2">
                      Tech Stack Terdaftar:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {project.tech_stack.map((tech: string) => (
                        <span
                          key={tech}
                          className="rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-ink"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right 1 Col: Linked Accounts & Quick Metadata */}
            <div className="space-y-6">
              <div className="rounded-panel border border-line bg-glass p-5 backdrop-blur-sm shadow-soft space-y-3">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-500" />
                  <span>Akun Terkait Project</span>
                </h3>

                {projectAccounts.length > 0 ? (
                  <div className="space-y-2">
                    {projectAccounts.map((pa: any) => (
                      <div
                        key={pa.account_id}
                        className="rounded-btn border border-line bg-card/60 p-2.5 text-xs"
                      >
                        <div className="font-semibold text-ink">{pa.accounts?.label}</div>
                        <div className="text-mute text-[11px] truncate">
                          {pa.accounts?.identifier}
                        </div>
                        {pa.accounts?.services?.name && (
                          <span className="mt-1 inline-block rounded bg-line px-1.5 py-0.2 text-[9px] font-bold uppercase text-mute">
                            {pa.accounts.services.name}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-mute">Belum ada akun yang dikaitkan.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* RESOURCES TAB */}
        {activeTab === "resources" && (
          <div className="rounded-panel border border-line bg-glass p-6 backdrop-blur-sm shadow-soft">
            <h3 className="text-base font-bold text-ink mb-4">Daftar Resource Project</h3>
            {projectResources.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projectResources.map((pr: any) => (
                  <div
                    key={pr.resource_id}
                    className="flex flex-col justify-between rounded-btn border border-line bg-card/70 p-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal">
                          {pr.role || "Resource"}
                        </span>
                        <span className="text-[10px] text-mute">{pr.resources?.category}</span>
                      </div>
                      <h4 className="font-bold text-sm text-ink">{pr.resources?.title}</h4>
                      {pr.resources?.notes && (
                        <p className="mt-1 text-xs text-mute">{pr.resources.notes}</p>
                      )}
                    </div>

                    <a
                      href={pr.resources?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-teal hover:underline"
                    >
                      <span className="truncate">{pr.resources?.url}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-mute">Belum ada resource pada project ini.</p>
            )}
          </div>
        )}

        {/* APPLICATIONS TAB */}
        {activeTab === "applications" && (
          <div className="rounded-panel border border-line bg-glass p-6 backdrop-blur-sm shadow-soft">
            <h3 className="text-base font-bold text-ink mb-4">Aplikasi Dalam Project Ini</h3>
            {applications.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {applications.map((app: any) => (
                  <div
                    key={app.id}
                    className="rounded-btn border border-line bg-card/70 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-teal uppercase">{app.type}</span>
                      <StatusBadge status={app.status} />
                    </div>
                    <h4 className="font-bold text-base text-ink">{app.name}</h4>
                    {app.framework && (
                      <p className="text-xs text-mute">Framework: {app.framework}</p>
                    )}
                    {app.production_url && (
                      <a
                        href={app.production_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline block truncate"
                      >
                        <Globe className="h-3 w-3 shrink-0" />
                        <span>{app.production_url}</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-mute">Belum ada aplikasi dalam project ini.</p>
            )}
          </div>
        )}

        {/* ACCOUNTS TAB */}
        {activeTab === "accounts" && (
          <div className="rounded-panel border border-line bg-glass p-6 backdrop-blur-sm shadow-soft">
            <h3 className="text-base font-bold text-ink mb-4">Akun & Layanan Terkait</h3>
            {projectAccounts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {projectAccounts.map((pa: any) => (
                  <div
                    key={pa.account_id}
                    className="rounded-btn border border-line bg-card/70 p-4 space-y-1"
                  >
                    <span className="text-[10px] font-bold text-purple-500 uppercase">
                      {pa.accounts?.services?.name || "Akun"}
                    </span>
                    <div className="font-bold text-ink text-sm">{pa.accounts?.label}</div>
                    <div className="text-xs text-mute truncate">{pa.accounts?.identifier}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-mute">Belum ada akun terkait.</p>
            )}
          </div>
        )}

        {/* TASKS TAB */}
        {activeTab === "tasks" && (
          <div className="rounded-panel border border-line bg-glass p-6 backdrop-blur-sm shadow-soft space-y-3">
            <h3 className="text-base font-bold text-ink mb-2">Task Project Ini</h3>
            {tasks.length > 0 ? (
              <div className="space-y-2">
                {tasks.map((task: any) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-btn border border-line bg-card/60 p-3"
                  >
                    <div>
                      <h4 className="font-semibold text-sm text-ink">{task.title}</h4>
                      {task.due_date && (
                        <span className="text-xs text-mute">
                          Jatuh tempo: {formatDateIndo(task.due_date)}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={task.priority} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-mute">Tidak ada task pada project ini.</p>
            )}
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === "notes" && (
          <div className="rounded-panel border border-line bg-glass p-6 backdrop-blur-sm shadow-soft space-y-3">
            <h3 className="text-base font-bold text-ink mb-2">Catatan Project</h3>
            {notes.length > 0 ? (
              <div className="space-y-3">
                {notes.map((n: any) => (
                  <div key={n.id} className="rounded-btn border border-line bg-card/60 p-4">
                    <h4 className="font-bold text-sm text-ink">{n.title || "Catatan"}</h4>
                    <p className="mt-1 text-xs text-mute whitespace-pre-wrap">{n.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-mute">Belum ada catatan untuk project ini.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
