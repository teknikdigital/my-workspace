-- ==============================================================================
-- DEMO DATA SEED FUNCTION (IDEMPOTENT & SCHEMA-ALIGNED)
-- Run manual after creating user: select seed_demo_data('<user-uuid>');
-- ==============================================================================

create or replace function seed_demo_data(target_user uuid)
returns text
language plpgsql
security definer
as $$
declare
  svc_google uuid;
  svc_github uuid;
  svc_supabase uuid;
  svc_vercel uuid;

  acc_gmail_dev uuid;
  acc_gmail_personal uuid;
  acc_github_work uuid;
  acc_supabase_main uuid;
  acc_vercel_prod uuid;

  proj_warehouse uuid;
  proj_energy uuid;
  proj_finance uuid;

  app_warehouse_web uuid;
  app_warehouse_gas uuid;
  app_energy_pwa uuid;
  app_finance_next uuid;

  res_sb_warehouse uuid;
  res_gh_warehouse uuid;
  res_vercel_warehouse uuid;
  res_gas_warehouse uuid;
  res_sheet_warehouse uuid;

  res_sb_energy uuid;
  res_gh_energy uuid;

  res_sb_finance uuid;
  res_gh_finance uuid;
begin
  -- 1. Services
  select id into svc_google from services where user_id = target_user and slug = 'google' limit 1;
  if svc_google is null then
    insert into services (user_id, name, slug, category, website_url)
    values (target_user, 'Google', 'google', 'other', 'https://google.com')
    returning id into svc_google;
  end if;

  select id into svc_github from services where user_id = target_user and slug = 'github' limit 1;
  if svc_github is null then
    insert into services (user_id, name, slug, category, website_url)
    values (target_user, 'GitHub', 'github', 'other', 'https://github.com')
    returning id into svc_github;
  end if;

  select id into svc_supabase from services where user_id = target_user and slug = 'supabase' limit 1;
  if svc_supabase is null then
    insert into services (user_id, name, slug, category, website_url)
    values (target_user, 'Supabase', 'supabase', 'other', 'https://supabase.com')
    returning id into svc_supabase;
  end if;

  select id into svc_vercel from services where user_id = target_user and slug = 'vercel' limit 1;
  if svc_vercel is null then
    insert into services (user_id, name, slug, category, website_url)
    values (target_user, 'Vercel', 'vercel', 'other', 'https://vercel.com')
    returning id into svc_vercel;
  end if;

  -- 2. Accounts
  select id into acc_gmail_dev from accounts where user_id = target_user and email = 'dev.workspace@gmail.com' limit 1;
  if acc_gmail_dev is null then
    insert into accounts (user_id, service_id, label, email, username, purpose_tags, notes, is_active)
    values (target_user, svc_google, 'Gmail Development', 'dev.workspace@gmail.com', 'devworkspace', array['dev', 'gcp'], 'Akun utama untuk Google Cloud & Apps Script dev', true)
    returning id into acc_gmail_dev;
  end if;

  select id into acc_gmail_personal from accounts where user_id = target_user and email = 'personal.me@gmail.com' limit 1;
  if acc_gmail_personal is null then
    insert into accounts (user_id, service_id, label, email, username, purpose_tags, notes, is_active)
    values (target_user, svc_google, 'Gmail Pribadi', 'personal.me@gmail.com', 'personalme', array['personal'], 'Akun personal drive & email', true)
    returning id into acc_gmail_personal;
  end if;

  select id into acc_github_work from accounts where user_id = target_user and email = 'octodev@workspace.io' limit 1;
  if acc_github_work is null then
    insert into accounts (user_id, service_id, label, email, username, purpose_tags, notes, is_active)
    values (target_user, svc_github, 'GitHub Organisasi Work', 'octodev@workspace.io', 'octodev-workspace', array['work', 'repos'], 'Organization repo access', true)
    returning id into acc_github_work;
  end if;

  select id into acc_supabase_main from accounts where user_id = target_user and email = 'sb-owner@workspace.io' limit 1;
  if acc_supabase_main is null then
    insert into accounts (user_id, service_id, label, email, username, purpose_tags, notes, is_active)
    values (target_user, svc_supabase, 'Supabase Pro Account', 'sb-owner@workspace.io', 'sb-owner', array['database', 'cloud'], 'Dashboard hosting DB utama', true)
    returning id into acc_supabase_main;
  end if;

  select id into acc_vercel_prod from accounts where user_id = target_user and email = 'team-vercel@workspace.io' limit 1;
  if acc_vercel_prod is null then
    insert into accounts (user_id, service_id, label, email, username, purpose_tags, notes, is_active)
    values (target_user, svc_vercel, 'Vercel Production Team', 'team-vercel@workspace.io', 'vercel-team', array['deployment'], 'Deployments and domains', true)
    returning id into acc_vercel_prod;
  end if;

  -- 3. Projects
  select id into proj_warehouse from projects where user_id = target_user and slug = 'warehouse-monitoring' limit 1;
  if proj_warehouse is null then
    insert into projects (user_id, name, slug, description, status, tags)
    values (target_user, 'Warehouse Monitoring', 'warehouse-monitoring', 'Sistem monitoring stok gudang, inventaris, dan integrasi spreadsheet otomatis', 'development', array['Logistics', 'Next.js', 'Supabase'])
    returning id into proj_warehouse;
  end if;

  select id into proj_energy from projects where user_id = target_user and slug = 'energy-power-meter' limit 1;
  if proj_energy is null then
    insert into projects (user_id, name, slug, description, status, tags)
    values (target_user, 'Energy Power Meter', 'energy-power-meter', 'Dashboard konsumsi daya listrik IoT real-time dengan alert ambang batas', 'testing', array['IoT', 'Utilities', 'PWA'])
    returning id into proj_energy;
  end if;

  select id into proj_finance from projects where user_id = target_user and slug = 'finance-app' limit 1;
  if proj_finance is null then
    insert into projects (user_id, name, slug, description, status, tags)
    values (target_user, 'Finance App', 'finance-app', 'Aplikasi pelacakan pengeluaran, anggaran bulanan, dan invoice client', 'planning', array['Finance', 'PostgreSQL'])
    returning id into proj_finance;
  end if;

  -- 4. Applications
  select id into app_warehouse_web from applications where project_id = proj_warehouse and slug = 'warehouse-web-app' limit 1;
  if app_warehouse_web is null then
    insert into applications (user_id, project_id, name, slug, app_type, description, status)
    values (target_user, proj_warehouse, 'Warehouse Web App', 'warehouse-web-app', 'nextjs', 'Next.js 14 App Router dashboard', 'active')
    returning id into app_warehouse_web;
  end if;

  select id into app_warehouse_gas from applications where project_id = proj_warehouse and slug = 'warehouse-gas' limit 1;
  if app_warehouse_gas is null then
    insert into applications (user_id, project_id, name, slug, app_type, description, status)
    values (target_user, proj_warehouse, 'Warehouse Google Apps Script', 'warehouse-gas', 'apps_script', 'Google Apps Script V8 barcode sync', 'active')
    returning id into app_warehouse_gas;
  end if;

  select id into app_energy_pwa from applications where project_id = proj_energy and slug = 'energy-meter-pwa' limit 1;
  if app_energy_pwa is null then
    insert into applications (user_id, project_id, name, slug, app_type, description, status)
    values (target_user, proj_energy, 'Energy Meter PWA', 'energy-meter-pwa', 'pwa', 'Next.js PWA + WebSockets telemetry', 'active')
    returning id into app_energy_pwa;
  end if;

  select id into app_finance_next from applications where project_id = proj_finance and slug = 'finance-core-web' limit 1;
  if app_finance_next is null then
    insert into applications (user_id, project_id, name, slug, app_type, description, status)
    values (target_user, proj_finance, 'Finance Core Web', 'finance-core-web', 'nextjs', 'Next.js + TypeScript invoice manager', 'active')
    returning id into app_finance_next;
  end if;

  -- 5. Resources
  select id into res_sb_warehouse from resources where user_id = target_user and name = 'Supabase Warehouse DB' limit 1;
  if res_sb_warehouse is null then
    insert into resources (user_id, name, category, url, service_id, notes)
    values (target_user, 'Supabase Warehouse DB', 'supabase', 'https://supabase.com/dashboard/project/wh-db-9823', svc_supabase, 'Database PostgreSQL untuk inventory & auth')
    returning id into res_sb_warehouse;
  end if;

  select id into res_gh_warehouse from resources where user_id = target_user and name = 'GitHub Warehouse Repository' limit 1;
  if res_gh_warehouse is null then
    insert into resources (user_id, name, category, url, service_id, notes)
    values (target_user, 'GitHub Warehouse Repository', 'github', 'https://github.com/octodev-workspace/warehouse-monitoring', svc_github, 'Main repo frontend and DB scripts')
    returning id into res_gh_warehouse;
  end if;

  select id into res_vercel_warehouse from resources where user_id = target_user and name = 'Vercel Warehouse Deployment' limit 1;
  if res_vercel_warehouse is null then
    insert into resources (user_id, name, category, url, service_id, notes)
    values (target_user, 'Vercel Warehouse Deployment', 'vercel', 'https://vercel.com/team-workspace/warehouse-monitoring', svc_vercel, 'Production edge deployment pipeline')
    returning id into res_vercel_warehouse;
  end if;

  select id into res_gas_warehouse from resources where user_id = target_user and name = 'Apps Script Warehouse Editor' limit 1;
  if res_gas_warehouse is null then
    insert into resources (user_id, name, category, url, service_id, notes)
    values (target_user, 'Apps Script Warehouse Editor', 'apps_script', 'https://script.google.com/d/1234567890abcdef/edit', svc_google, 'Google Apps Script untuk sinkronisasi barcode scanner')
    returning id into res_gas_warehouse;
  end if;

  select id into res_sheet_warehouse from resources where user_id = target_user and name = 'Google Sheet Warehouse Master' limit 1;
  if res_sheet_warehouse is null then
    insert into resources (user_id, name, category, url, service_id, notes)
    values (target_user, 'Google Sheet Warehouse Master', 'google_sheet', 'https://docs.google.com/spreadsheets/d/1234567890abcdef/edit', svc_google, 'Spreadsheet master stock item & barcode')
    returning id into res_sheet_warehouse;
  end if;

  select id into res_sb_energy from resources where user_id = target_user and name = 'Supabase Energy DB' limit 1;
  if res_sb_energy is null then
    insert into resources (user_id, name, category, url, service_id, notes)
    values (target_user, 'Supabase Energy DB', 'supabase', 'https://supabase.com/dashboard/project/energy-db-4411', svc_supabase, 'Time-series telemetry database')
    returning id into res_sb_energy;
  end if;

  select id into res_gh_energy from resources where user_id = target_user and name = 'GitHub Energy Repository' limit 1;
  if res_gh_energy is null then
    insert into resources (user_id, name, category, url, service_id, notes)
    values (target_user, 'GitHub Energy Repository', 'github', 'https://github.com/octodev-workspace/energy-meter-pwa', svc_github, 'PWA client repository')
    returning id into res_gh_energy;
  end if;

  -- 6. Relationships (Many-to-Many)
  insert into project_accounts (project_id, account_id, role) values
    (proj_warehouse, acc_gmail_dev, 'owner'),
    (proj_warehouse, acc_github_work, 'owner'),
    (proj_warehouse, acc_supabase_main, 'admin'),
    (proj_energy, acc_github_work, 'owner'),
    (proj_energy, acc_supabase_main, 'admin'),
    (proj_finance, acc_github_work, 'owner')
  on conflict do nothing;

  insert into project_resources (project_id, resource_id, role) values
    (proj_warehouse, res_sb_warehouse, 'database'),
    (proj_warehouse, res_gh_warehouse, 'repository'),
    (proj_warehouse, res_vercel_warehouse, 'deployment'),
    (proj_warehouse, res_gas_warehouse, 'legacy'),
    (proj_warehouse, res_sheet_warehouse, 'other'),
    (proj_energy, res_sb_energy, 'database'),
    (proj_energy, res_gh_energy, 'repository')
  on conflict do nothing;

  insert into application_resources (application_id, resource_id, role) values
    (app_warehouse_web, res_sb_warehouse, 'database'),
    (app_warehouse_web, res_gh_warehouse, 'repository'),
    (app_warehouse_web, res_vercel_warehouse, 'deployment'),
    (app_warehouse_gas, res_gas_warehouse, 'legacy'),
    (app_warehouse_gas, res_sheet_warehouse, 'other'),
    (app_energy_pwa, res_sb_energy, 'database'),
    (app_energy_pwa, res_gh_energy, 'repository')
  on conflict do nothing;

  insert into application_accounts (application_id, account_id, role) values
    (app_warehouse_web, acc_supabase_main, 'admin'),
    (app_warehouse_web, acc_vercel_prod, 'admin'),
    (app_warehouse_gas, acc_gmail_dev, 'owner')
  on conflict do nothing;

  -- 7. Tasks
  insert into tasks (user_id, project_id, application_id, title, description, status, priority, due_date, source)
  values
    (target_user, proj_warehouse, app_warehouse_web, 'Perbaiki RLS inventory warehouse', 'Pastikan query inventory membaca user_id dengan benar pada policy Postgres', 'in_progress', 'urgent', current_date, 'manual'),
    (target_user, proj_warehouse, app_warehouse_gas, 'Integrasikan webhook scanner barcode', 'Pasang endpoint POST untuk menerima barcode payload dari Apps Script', 'todo', 'high', current_date, 'manual'),
    (target_user, proj_energy, app_energy_pwa, 'Audit konsumsi energi peak load', 'Analisis lonjakan daya pada telemetry meter minggu ini', 'todo', 'medium', current_date + 2, 'manual'),
    (target_user, proj_finance, app_finance_next, 'Susun skema tabel invoice & billing', 'Buat migrasi initial untuk entitas invoice di Finance App', 'todo', 'low', current_date + 5, 'manual'),
    (target_user, proj_warehouse, app_warehouse_gas, 'Konfigurasi alert email kegagalan sync', 'Kirim email jika sinkronisasi Google Sheet timeout > 30s', 'done', 'medium', current_date - 1, 'manual')
  on conflict do nothing;

  -- 8. Notes
  insert into notes (user_id, project_id, application_id, title, content, tags, is_pinned)
  values
    (target_user, proj_warehouse, app_warehouse_web, 'Struktur database warehouse', 'Tabel inventory berelasi ke stock_items dan warehouses. Menggunakan trigger update timestamp dan RLS berbasis user_id.', array['database', 'architecture'], true),
    (target_user, proj_warehouse, app_warehouse_gas, 'Catatan migrasi Apps Script', 'Apps script V8 menggunakan OAuth Google Workspace. URL endpoint Web App memerlukan exec permissions.', array['apps_script', 'google'], false),
    (target_user, null, null, 'Ide fitur personal OS', 'Menghubungkan catatan harian dengan task otomatis via AI dan sinkronisasi WhatsApp.', array['ideas', 'ai'], false)
  on conflict do nothing;

  -- 9. Activity Logs
  insert into activity_logs (user_id, project_id, summary, source, created_at)
  values
    (target_user, proj_warehouse, 'Memperbaiki RLS pada tabel inventory dan verifikasi query index', 'manual', now() - interval '25 minutes'),
    (target_user, proj_warehouse, 'Menambahkan deployment preview Vercel untuk pull request #14', 'manual', now() - interval '3 hours'),
    (target_user, proj_energy, 'Pengujian telemetry WebSocket stream pada dashboard energy meter', 'manual', now() - interval '1 day'),
    (target_user, proj_finance, 'Inisiasi project Finance App dan draft modul budget planning', 'manual', now() - interval '4 days')
  on conflict do nothing;

  return 'Demo data seeded successfully for user ' || target_user::text;
end;
$$;
