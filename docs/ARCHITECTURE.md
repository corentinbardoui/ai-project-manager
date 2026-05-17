# Architecture

## Overview

Vela is a Next.js 15 monorepo. The frontend and backend live in the same codebase — API routes handle all AI and database logic server-side; React components handle the UI.

```
┌─────────────────────────────────────────────────────┐
│                     Browser                          │
│                                                      │
│   ┌──────────────┐        ┌──────────────────────┐  │
│   │  ChatPanel   │        │    PipelineView       │  │
│   │  (useChat)   │        │  (Kanban + Realtime)  │  │
│   └──────┬───────┘        └──────────┬────────────┘  │
│          │ POST /api/chat            │ WebSocket      │
└──────────┼───────────────────────────┼───────────────┘
           │                           │
┌──────────▼───────────────────────────▼───────────────┐
│                  Next.js API Routes                   │
│                                                       │
│   /api/chat/route.ts          /api/task/run/route.ts  │
│   (streaming + tool calls)    (agent execution)       │
└──────────┬────────────────────────────────────────────┘
           │
┌──────────▼────────────────┐    ┌──────────────────────┐
│       Anthropic Claude    │    │       Supabase        │
│   (claude-sonnet-4-6)     │    │  PostgreSQL + Realtime│
│   Vercel AI SDK           │    │  tasks, agents,       │
│   streaming + tool calls  │    │  workspaces, context  │
└───────────────────────────┘    └──────────────────────┘
```

---

## Data Flow

### Chat → Board (main loop)

```
1. User sends message in ChatPanel
2. useChat (Vercel AI SDK) streams POST /api/chat
3. Claude receives: system prompt + board snapshot + conversation history
4. Claude responds + optionally calls tools (create_task, reprioritize_tasks, etc.)
5. Tools execute Supabase mutations server-side
6. Supabase Realtime pushes postgres_changes to the browser
7. PipelineView updates instantly — no refresh, no polling
```

### Agent Execution

```
1. User assigns an agent to a task and clicks Run
2. POST /api/task/run with { taskId, agentId }
3. Server fetches task + agent from Supabase
4. Claude runs with agent's system_prompt + task context
5. Result streams back, saved to tasks.result column
6. Realtime pushes the update → task card shows result badge
```

---

## Key Design Decisions

### Human-in-the-loop by design
The AI cannot move tasks to `done`. The `update_task_status` tool explicitly rejects `done` as a target. Only the user can archive a task after reviewing the agent's output. This prevents silent task completion and keeps the user in control.

### Board snapshot in system prompt
Every chat request includes a JSON snapshot of the current pipeline state. The AI always has full context of what exists before creating or modifying tasks — preventing duplicates and enabling intelligent prioritization.

### Prompt centralization
All system prompts live in `src/lib/agents.ts` as named exports (`DEFAULT_SYSTEM_PROMPT`, `ONBOARDING_SYSTEM_PROMPT`). No prompts are embedded inline in route handlers or components. One file to read, one file to change.

### Supabase client as lazy singleton
The Supabase browser client (`src/lib/supabase.ts`) is wrapped in a `Proxy` to defer initialization until first use. This prevents Next.js from throwing during static build when env vars aren't available at module load time.

### Realtime merge strategy
Supabase Realtime `UPDATE` events contain only changed columns in `payload.new`. The workspace page merges incoming updates with local state (`{ ...prev, ...incoming, result: incoming.result ?? prev.result }`) to prevent large fields (like `result`) from being erased when unrelated columns update.

---

## Pipeline States

```
backlog → todo → in_progress → done
```

| State | Label | Who controls |
|---|---|---|
| `backlog` | Backlog | AI creates here by default |
| `todo` | Next Actions | AI promotes via `reprioritize_tasks` (max 5) |
| `in_progress` | Active Zone | Set when agent runs |
| `done` | Archives | User only — never AI |

---

## Database Schema

Core tables (see `supabase/` for full migrations):

- **`tasks`** — title, description, status, position, result, assigned_agent_id, workspace_id
- **`custom_agents`** — name, handle, emoji, system_prompt, workspace_id
- **`workspaces`** — name, slug
- **`app_settings`** — key/value store (used for project context)

All tables have RLS enabled. The current policy is open for MVP — production would scope by user/workspace auth.
