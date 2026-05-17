-- AI Project Manager — Supabase Schema
-- Run this in the Supabase SQL Editor to initialize the database.

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Tasks table
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  status      text not null default 'todo'
              check (status in ('todo', 'in_progress', 'done')),
  assignee_type text not null default 'human'
              check (assignee_type in ('human', 'ai_agent_name')),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Index for fast column queries
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_position_idx on public.tasks (status, position);

-- Enable Row Level Security (RLS) — open policy for MVP
alter table public.tasks enable row level security;

create policy "Allow all operations for now"
  on public.tasks
  for all
  using (true)
  with check (true);

-- Enable Supabase Realtime on the tasks table
alter publication supabase_realtime add table public.tasks;
