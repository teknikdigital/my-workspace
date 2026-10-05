# My Workspace — Agent Guide & Architecture

## Overview
My Workspace is a Personal Work & Life OS designed to unify digital assets, projects, applications, accounts, credentials, notes, and tasks.

## Core Rules & Invariants
1. **Single User Design with Multi-User Ready RLS**: RLS is strictly enabled on all tables with `user_id = auth.uid()`.
2. **Relationships as First-Class Citizens**:
   - `1 Account` can be linked to multiple `Projects` via `project_accounts` and `Applications` via `application_accounts`.
   - `1 Resource` can be linked to multiple `Projects` / `Applications` with roles (`database`, `repository`, `deployment`, `legacy`, `other`).
   - `search_index` view uses `security_invoker = true`.
3. **Security**:
   - Zero secrets logged or returned in search/errors/client.
   - `SUPABASE_SERVICE_ROLE_KEY` and `VAULT_ENCRYPTION_KEY` are server-only.
   - Vault values encrypted with AES-256-GCM.
   - Re-auth required before secret reveal.
   - WhatsApp webhook signature verification and phone whitelist.
   - External integration receiver authenticated via hash token.
4. **UI/UX**:
   - Floating pill TopBar and BottomNav with glassmorphism.
   - Plus Jakarta Sans font, clean dark/light mode with CSS variables.
   - All UI in Indonesian, code/identifiers in English.
