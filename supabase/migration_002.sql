-- Migration 002 — Custom agents, task results, chat history
-- Run this in the Supabase SQL Editor AFTER schema.sql

-- ── Tasks: add result and agent assignment ────────────────────────────────────
alter table public.tasks
  add column if not exists result           text,
  add column if not exists assigned_agent_id uuid;

-- ── Custom agents (task workers) ─────────────────────────────────────────────
create table if not exists public.custom_agents (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  handle        text not null,
  emoji         text not null default '🤖',
  color         text not null default 'slate',
  system_prompt text not null,
  created_at    timestamptz not null default now()
);

alter table public.custom_agents enable row level security;
create policy "Allow all for MVP"
  on public.custom_agents for all using (true) with check (true);

-- FK: tasks → custom_agents
alter table public.tasks
  add constraint tasks_custom_agent_fk
  foreign key (assigned_agent_id)
  references public.custom_agents(id)
  on delete set null;

-- ── Chat conversations ────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id            uuid primary key default gen_random_uuid(),
  title         text not null default 'Nouvelle conversation',
  chat_agent_id text not null default 'product_owner',
  created_at    timestamptz not null default now()
);

alter table public.conversations enable row level security;
create policy "Allow all for MVP"
  on public.conversations for all using (true) with check (true);

create table if not exists public.conversation_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists conv_messages_conv_idx
  on public.conversation_messages(conversation_id, created_at);

alter table public.conversation_messages enable row level security;
create policy "Allow all for MVP"
  on public.conversation_messages for all using (true) with check (true);
