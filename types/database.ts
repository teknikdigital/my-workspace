export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProjectStatus =
  | "planning"
  | "development"
  | "testing"
  | "production"
  | "maintenance"
  | "archived";

export type AppType =
  | "nextjs"
  | "apps_script"
  | "pwa"
  | "streamlit"
  | "static"
  | "backend"
  | "other";

export type ResourceCategory =
  | "github"
  | "supabase"
  | "vercel"
  | "apps_script"
  | "google_sheet"
  | "google_drive"
  | "figma"
  | "postman"
  | "documentation"
  | "production"
  | "staging"
  | "other";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskSource = "manual" | "ai" | "claude" | "whatsapp" | "activity";
export type NoteScope = "personal" | "work" | "project";
export type ResourceRole = "database" | "repository" | "deployment" | "legacy" | "other" | "";

export type CredentialType =
  | "password"
  | "api_key"
  | "token"
  | "service_role_key"
  | "recovery_code"
  | "secret";

export type AuditAction = "create" | "reveal" | "copy" | "update" | "delete";

export interface Profile {
  user_id: string;
  display_name: string | null;
  role_label: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  progress: number;
  category: string | null;
  tech_stack: string[];
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  type: AppType;
  framework: string | null;
  production_url: string | null;
  staging_url: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  user_id: string;
  name: string;
  slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  service_id: string | null;
  label: string;
  identifier: string;
  notes: string | null;
  is_personal: boolean;
  created_at: string;
  updated_at: string;
  service?: Service | null;
}

export interface Resource {
  id: string;
  user_id: string;
  title: string;
  url: string;
  category: ResourceCategory;
  account_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  account?: Account | null;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  project_id: string | null;
  application_id: string | null;
  source: TaskSource;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  project?: Project | null;
  application?: Application | null;
}

export interface Note {
  id: string;
  user_id: string;
  title: string | null;
  body: string | null;
  scope: NoteScope;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  project_id: string | null;
  summary: string;
  source: string;
  created_at: string;
  updated_at?: string;
  project?: Project | null;
}

export interface CredentialMetadata {
  id: string;
  user_id: string;
  service_id: string | null;
  label: string;
  identifier: string | null;
  credential_type: CredentialType;
  notes: string | null;
  created_at: string;
  updated_at: string;
  service?: Service | null;
}

export interface VaultAuditLog {
  id: string;
  user_id: string;
  credential_id: string | null;
  credential_label: string | null;
  action: AuditAction;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  user_id: string;
  title: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderItem {
  id: string;
  user_id: string;
  title: string;
  due_at: string;
  is_completed: boolean;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface PersonalLink {
  id: string;
  user_id: string;
  title: string;
  url: string;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectAccount {
  project_id: string;
  account_id: string;
  user_id: string;
  account?: Account;
}

export interface ProjectResource {
  project_id: string;
  resource_id: string;
  role: ResourceRole;
  user_id: string;
  resource?: Resource;
}

export interface ApplicationResource {
  application_id: string;
  resource_id: string;
  role: ResourceRole;
  user_id: string;
  resource?: Resource;
}

export interface ApplicationAccount {
  application_id: string;
  account_id: string;
  user_id: string;
  account?: Account;
}

export interface NoteLink {
  id: string;
  note_id: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
}

export interface SearchResultItem {
  entity_type: "project" | "application" | "resource" | "account" | "task" | "note";
  entity_id: string;
  title: string;
  subtitle: string;
  url_path: string;
  rank?: number;
}
