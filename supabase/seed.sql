-- ==============================================================================
-- DEMO DATA SEED FUNCTION (IDEMPOTENT)
-- Run manual after creating the first user: select seed_demo_data('<user-uuid>');
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
  -- 1. Check or Insert Services
  select id into svc_google from services where user_id = target_user and slug = 'google' limit 1;
  if svc_google is null then
    insert into services (user_id, name, slug) values (target_user, 'Google', 'google') returning id into svc_google;
  end if;

  select id into svc_github from services where user_id = target_user and slug = 'github' limit 1;
  if svc_github is null then
    insert into services (user_id, name, slug) values (target_user, 'GitHub', 'github') returning id into svc_github;
  end if;

  select id into svc_supabase from services where user_id = target_user and slug = 'supabase' limit 1;
  if svc_supabase is null then
    insert into services (user_id, name, slug) values (target_user, 'Supabase', 'supabase') returning id into svc_supabase;
  end if;

  select id into svc_vercel from services where user_id = target_user and slug = 'vercel' limit 1;
  if svc_vercel is null then
    insert into services (user_id, name, slug) values (target_user, 'Vercel', 'vercel') returning id into svc_vercel;
  end if;

  -- 2. Accounts
  select id into acc_gmail_dev from accounts where user_id = target_user and identifier = 'dev.workspace@gmail.com' limit 1;
  if acc_gmail_dev is null then
    insert into accounts (user_id, service_id, label, identifier, notes, is_personal)
    values (target_user, svc_google, 'Gmail Development', 'dev.workspace@gmail.com', 'Akun utama untuk Google Cloud & Apps Script dev', false)
    returning id into acc_gmail_dev;
  end if;

  select id into acc_gmail_personal from accounts where user_id = target_user and identifier = 'personal.me@gmail.com' limit 1;
  if acc_gmail_personal is null then
    insert into accounts (user_id, service_id, label, identifier, notes, is_personal)
    values (target_user, svc_google, 'Gmail Pribadi', 'personal.me@gmail.com', 'Akun personal drive & email', true)
    returning id into acc_gmail_personal;
  end if;

  select id into acc_github_work from accounts where user_id = target_user and identifier = 'octodev-workspace' limit 1;
  if acc_github_work is null then
    insert into accounts (user_id, service_id, label, identifier, notes, is_personal)
    values (target_user, svc_github, 'GitHub Organisasi Work', 'octodev-workspace', 'Organization repo access', false)
    returning id into acc_github_work;
  end if;

  select id into acc_supabase_main from accounts where user_id = target_user and identifier = 'sb-owner@workspace.io' limit 1;
  if acc_supabase_main is null then
    insert into accounts (user_id, service_id, label, identifier, notes, is_personal)
    values (target_user, svc_supabase, 'Supabase Pro Account', 'sb-owner@workspace.io', 'Dashboard hosting DB utama', false)
    returning id into acc_supabase_main;
  end if;

  select id into acc_vercel_prod from accounts where user_id = target_user and identifier = 'team-vercel@workspace.io' limit 1;
  if acc_vercel_prod is null then
    insert into accounts (user_id, service_id, label, identifier, notes, is_personal)
    values (target_user, svc_vercel, 'Vercel Production Team', 'team-vercel@workspace.io', 'Deployments and domains', false)
    returning id into acc_vercel_prod;
  end if;

  -- 3. Projects
  select id into proj_warehouse from projects where user_id = target_user and name = 'Warehouse Monitoring' limit 1;
  if proj_warehouse is null then
    insert into projects (user_id, name, description, status, progress, category, tech_stack, last_opened_at)
    values (target_user, 'Warehouse Monitoring', 'Sistem monitoring stok gudang, inventaris, dan integrasi spreadsheet otomatis', 'development', 65, 'Logistics', array['Next.js', 'Supabase', 'Apps Script', 'Tailwind'], now())
    returning id into proj_warehouse;
  end if;

  select id into proj_energy from projects where user_id = target_user and name = 'Energy Power Meter' limit 1;
  if proj_energy is null then
    insert into projects (user_id, name, description, status, progress, category, tech_stack, last_opened_at)
    values (target_user, 'Energy Power Meter', 'Dashboard konsumsi daya listrik IoT real-time dengan alert ambang batas', 'testing', 85, 'IoT / Utilities', array['Next.js', 'PWA', 'Supabase', 'MQTT'], now() - interval '2 days')
    returning id into proj_energy;
  end if;

  select id into proj_finance from projects where user_id = target_user and name = 'Finance App' limit 1;
  if proj_finance is null then
    insert into projects (user_id, name, description, status, progress, category, tech_stack, last_opened_at)
    values (target_user, 'Finance App', 'Aplikasi pelacakan pengeluaran, anggaran bulanan, dan invoice client', 'planning', 20, 'Finance', array['Next.js', 'PostgreSQL', 'Tailwind'], now() - interval '5 days')
    returning id into proj_finance;
  end if;

  -- 4. Applications
  select id into app_warehouse_web from applications where user_id = target_user and name = 'Warehouse Web App' limit 1;
  if app_warehouse_web is null then
    insert into applications (user_id, project_id, name, type, framework, production_url, staging_url, status)
    values (target_user, proj_warehouse, 'Warehouse Web App', 'nextjs', 'Next.js 14 App Router', 'https://warehouse.workspace.io', 'https://staging-warehouse.workspace.io', 'development')
    returning id into app_warehouse_web;
  end if;

  select id into app_warehouse_gas from applications where user_id = target_user and name = 'Warehouse Google Apps Script' limit 1;
  if app_warehouse_gas is null then
    insert into applications (user_id, project_id, name, type, framework, production_url, staging_url, status)
    values (target_user, proj_warehouse, 'Warehouse Google Apps Script', 'apps_script', 'Google Apps Script V8', 'https://script.google.com/d/demo-warehouse-gas/edit', null, 'production')
    returning id into app_warehouse_gas;
  end if;

  select id into app_energy_pwa from applications where user_id = target_user and name = 'Energy Meter PWA' limit 1;
  if app_energy_pwa is null then
    insert into applications (user_id, project_id, name, type, framework, production_url, staging_url, status)
    values (target_user, proj_energy, 'Energy Meter PWA', 'pwa', 'Next.js PWA + WebSockets', 'https://energy.workspace.io', 'https://staging-energy.workspace.io', 'testing')
    returning id into app_energy_pwa;
  end if;

  select id into app_finance_next from applications where user_id = target_user and name = 'Finance Core Web' limit 1;
  if app_finance_next is null then
    insert into applications (user_id, project_id, name, type, framework, production_url, staging_url, status)
    values (target_user, proj_finance, 'Finance Core Web', 'nextjs', 'Next.js + TypeScript', 'https://finance.workspace.io', null, 'planning')
    returning id into app_finance_next;
  end if;

  -- 5. Resources
  select id into res_sb_warehouse from resources where user_id = target_user and title = 'Supabase Warehouse DB' limit 1;
  if res_sb_warehouse is null then
    insert into resources (user_id, title, url, category, account_id, notes)
    values (target_user, 'Supabase Warehouse DB', 'https://supabase.com/dashboard/project/wh-db-9823', 'supabase', acc_supabase_main, 'Database PostgreSQL untuk inventory & auth')
    returning id into res_sb_warehouse;
  end if;

  select id into res_gh_warehouse from resources where user_id = target_user and title = 'GitHub Warehouse Repository' limit 1;
  if res_gh_warehouse is null then
    insert into resources (user_id, title, url, category, account_id, notes)
    values (target_user, 'GitHub Warehouse Repository', 'https://github.com/octodev-workspace/warehouse-monitoring', 'github', acc_github_work, 'Main repo frontend and DB scripts')
    returning id into res_gh_warehouse;
  end if;

  select id into res_vercel_warehouse from resources where user_id = target_user and title = 'Vercel Warehouse Deployment' limit 1;
  if res_vercel_warehouse is null then
    insert into resources (user_id, title, url, category, account_id, notes)
    values (target_user, 'Vercel Warehouse Deployment', 'https://vercel.com/team-workspace/warehouse-monitoring', 'vercel', acc_vercel_prod, 'Production edge deployment pipeline')
    returning id into res_vercel_warehouse;
  end if;

  select id into res_gas_warehouse from resources where user_id = target_user and title = 'Apps Script Warehouse Editor' limit 1;
  if res_gas_warehouse is null then
    insert into resources (user_id, title, url, category, account_id, notes)
    values (target_user, 'Apps Script Warehouse Editor', 'https://script.google.com/d/1234567890abcdef/edit', 'apps_script', acc_gmail_dev, 'Google Apps Script untuk sinkronisasi barcode scanner')
    returning id into res_gas_warehouse;
  end if;

  select id into res_sheet_warehouse from resources where user_id = target_user and title = 'Google Sheet Warehouse Master' limit 1;
  if res_sheet_warehouse is null then
    insert into resources (user_id, title, url, category, account_id, notes)
    values (target_user, 'Google Sheet Warehouse Master', 'https://docs.google.com/spreadsheets/d/1234567890abcdef/edit', 'google_sheet', acc_gmail_dev, 'Spreadsheet master stock item & barcode')
    returning id into res_sheet_warehouse;
  end if;

  select id into res_sb_energy from resources where user_id = target_user and title = 'Supabase Energy DB' limit 1;
  if res_sb_energy is null then
    insert into resources (user_id, title, url, category, account_id, notes)
    values (target_user, 'Supabase Energy DB', 'https://supabase.com/dashboard/project/energy-db-4411', 'supabase', acc_supabase_main, 'Time-series telemetry database')
    returning id into res_sb_energy;
  end if;

  select id into res_gh_energy from resources where user_id = target_user and title = 'GitHub Energy Repository' limit 1;
  if res_gh_energy is null then
    insert into resources (user_id, title, url, category, account_id, notes)
    values (target_user, 'GitHub Energy Repository', 'https://github.com/octodev-workspace/energy-meter-pwa', 'github', acc_github_work, 'PWA client repository')
    returning id into res_gh_energy;
  end if;

  -- 6. Many-to-Many Relationships
  -- Project Accounts
  insert into project_accounts (project_id, account_id, user_id) values
    (proj_warehouse, acc_gmail_dev, target_user),
    (proj_warehouse, acc_github_work, target_user),
    (proj_warehouse, acc_supabase_main, target_user),
    (proj_energy, acc_github_work, target_user),
    (proj_energy, acc_supabase_main, target_user),
    (proj_finance, acc_github_work, target_user)
  on conflict do nothing;

  -- Project Resources with roles
  insert into project_resources (project_id, resource_id, role, user_id) values
    (proj_warehouse, res_sb_warehouse, 'database', target_user),
    (proj_warehouse, res_gh_warehouse, 'repository', target_user),
    (proj_warehouse, res_vercel_warehouse, 'deployment', target_user),
    (proj_warehouse, res_gas_warehouse, 'legacy', target_user),
    (proj_warehouse, res_sheet_warehouse, 'other', target_user),
    (proj_energy, res_sb_energy, 'database', target_user),
    (proj_energy, res_gh_energy, 'repository', target_user)
  on conflict do nothing;

  -- Application Resources with roles
  insert into application_resources (application_id, resource_id, role, user_id) values
    (app_warehouse_web, res_sb_warehouse, 'database', target_user),
    (app_warehouse_web, res_gh_warehouse, 'repository', target_user),
    (app_warehouse_web, res_vercel_warehouse, 'deployment', target_user),
    (app_warehouse_gas, res_gas_warehouse, 'legacy', target_user),
    (app_warehouse_gas, res_sheet_warehouse, 'database', target_user),
    (app_energy_pwa, res_sb_energy, 'database', target_user),
    (app_energy_pwa, res_gh_energy, 'repository', target_user)
  on conflict do nothing;

  -- Application Accounts
  insert into application_accounts (application_id, account_id, user_id) values
    (app_warehouse_web, acc_supabase_main, target_user),
    (app_warehouse_web, acc_vercel_prod, target_user),
    (app_warehouse_gas, acc_gmail_dev, target_user)
  on conflict do nothing;

  -- 7. Tasks
  insert into tasks (user_id, title, description, status, priority, due_date, project_id, application_id, source)
  values
    (target_user, 'Perbaiki RLS inventory warehouse', 'Pastikan query inventory membaca user_id dengan benar pada policy Postgres', 'in_progress', 'urgent', current_date, proj_warehouse, app_warehouse_web, 'manual'),
    (target_user, 'Integrasikan webhook scanner barcode', 'Pasang endpoint POST untuk menerima barcode payload dari Apps Script', 'todo', 'high', current_date, proj_warehouse, app_warehouse_gas, 'manual'),
    (target_user, 'Audit konsumsi energi peak load', 'Analisis lonjakan daya pada telemetry meter minggu ini', 'todo', 'medium', current_date + 2, proj_energy, app_energy_pwa, 'manual'),
    (target_user, 'Susun skema tabel invoice & billing', 'Buat migrasi initial untuk entitas invoice di Finance App', 'todo', 'low', current_date + 5, proj_finance, app_finance_next, 'manual'),
    (target_user, 'Konfigurasi alert email kegagalan sync', 'Kirim email jika sinkronisasi Google Sheet timeout > 30s', 'done', 'medium', current_date - 1, proj_warehouse, app_warehouse_gas, 'manual')
  on conflict do nothing;

  -- 8. Notes
  insert into notes (user_id, title, body, scope)
  values
    (target_user, 'Struktur database warehouse', 'Tabel inventory berelasi ke stock_items dan warehouses. Menggunakan trigger update timestamp dan RLS berbasis user_id.', 'work'),
    (target_user, 'Catatan migrasi Apps Script', 'Apps script V8 menggunakan OAuth Google Workspace. URL endpoint Web App memerlukan exec permissions.', 'project'),
    (target_user, 'Ide fitur personal OS', 'Menghubungkan catatan harian dengan task otomatis via AI dan sinkronisasi WhatsApp.', 'personal')
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
