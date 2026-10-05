# Architecture Decisions & Assumptions (DECISIONS.md)

| ID | Decision / Assumption | Rationale | Phase |
|---|---|---|---|
| DEC-001 | Single-user architecture with strict per-user RLS | As requested in spec; multi-user ready under the hood via `auth.uid()` checks. | Phase 1 |
| DEC-002 | Theme switcher via next-themes with CSS custom properties | Matches specified color tokens (`--bg-1`, `--bg-2`, `--teal`, `--orange`, etc.) without FOUC. | Phase 1 |
| DEC-003 | TopBar and BottomNav in `(app)` route group only; `(auth)` is isolated | Ensures login screen remains minimal, centered, without navigation bars. | Phase 1 |
| DEC-004 | Encryption via Server-Side AES-256-GCM using Node.js `crypto` with `VAULT_ENCRYPTION_KEY` | High performance, zero secret leaks to client or query logs, standard 12-byte IV + 16-byte auth tag. | Phase 2 |
| DEC-005 | Documents storage via Supabase Storage private bucket with time-limited signed URLs | Protects private attachments from direct public access. | Phase 2 |
| DEC-006 | AI Assistant supporting dual providers (OpenAI / Claude) via direct fetch and tool-calling with graceful fallback | Allows zero-dependency runtime switching; if keys are empty, renders a clean friendly setup state instead of error. | Phase 3 |
| DEC-007 | Structured Activity Receiver API protected by hashed bearer token (`ACTIVITY_WEBHOOK_SECRET`) | Enables Claude / CI scripts to post activity updates without full auth cookies. | Phase 4 |
| DEC-008 | WhatsApp Webhook with SHA256 signature verification & Owner phone number whitelist | Strict protection against unauthorized incoming webhook messages. | Phase 5 |
