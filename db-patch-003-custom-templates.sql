-- FormFlow — Patch 003: תבניות מותאמות פר-עסק (custom templates per business)
--
-- מוסיף טבלת custom_templates המקבילה למבנה שנשמר בצד-הלקוח (localBackend.ts):
-- לכל תבנית יש workspace_id (העסק שאליו היא שייכת) או NULL עבור תבנית גלובלית
-- המשותפת לכל העסקים של המשתמש. שדות התבנית (fields) נשמרים כ-JSON, כמו doc בטבלת forms.

-- ========== SQLite (server/store-sqlite.js) ==========
CREATE TABLE IF NOT EXISTS custom_templates (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT,                 -- NULL = גלובלית (כל העסקים של הבעלים)
  scope        TEXT NOT NULL DEFAULT 'workspace',  -- 'workspace' | 'global'
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  icon         TEXT NOT NULL DEFAULT 'file',
  category     TEXT NOT NULL DEFAULT 'כללי',
  fields       TEXT NOT NULL DEFAULT '[]',   -- JSON array של FormField
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_custom_templates_ws
  ON custom_templates(workspace_id);

-- ========== PostgreSQL 16 (מקביל, לפי פרק 6/8 באיפיון) ==========
-- create table if not exists public.custom_templates (
--   id           text primary key,
--   workspace_id text references public.workspaces(id) on delete cascade,
--   scope        text not null default 'workspace'
--                check (scope in ('workspace','global')),
--   name         text not null,
--   description  text not null default '',
--   icon         text not null default 'file',
--   category     text not null default 'כללי',
--   fields       jsonb not null default '[]'::jsonb,
--   created_at   timestamptz not null default now(),
--   updated_at   timestamptz not null default now()
-- );
-- create index if not exists idx_custom_templates_ws
--   on public.custom_templates(workspace_id);
--
-- -- הפרדת לקוחות (RLS): תבנית נגישה אם היא גלובלית או שייכת ל-workspace של המשתמש.
-- alter table public.custom_templates enable row level security;
-- create policy custom_templates_read on public.custom_templates
--   for select using (
--     scope = 'global'
--     or workspace_id in (
--       select id from public.workspaces
--       where owner_email = current_setting('app.user_email', true)
--          or members ? current_setting('app.user_email', true)
--     )
--   );
