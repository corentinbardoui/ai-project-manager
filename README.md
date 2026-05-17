# Vela — AI-Native Project Manager

> Describe what needs to get done. Vela structures, prioritizes, and executes the work.

![Vela Board](docs/screenshots/board-placeholder.png)

---

## The Problem

Project management tools are databases with a UI. You still do all the thinking — creating tasks, moving cards, deciding what's next. The AI layer is cosmetic.

**Vela flips the model.** You describe outcomes in natural language. The AI structures the pipeline, assigns priorities, and executes tasks through specialized agents. You validate the results.

---

## What is Vela?

Vela is a split-screen workspace: a **conversational AI** on the left, a **live Kanban board** on the right.

Every message to Vela can trigger real actions — tasks created, moved, reprioritized — reflected instantly on the board via real-time sync. AI agents can be assigned to tasks and produce concrete deliverables (drafts, analyses, structured outputs) attached directly to the card.

---

## How It Works

**1. Describe your project**
Vela's onboarding agent asks 3–4 questions in conversation and bootstraps your entire workspace — project context, first tasks, initial priorities.

**2. Talk to your board**
_"Create 5 tasks for the product launch sprint and prioritize the blocking ones."_
Vela creates the tasks, calls `reprioritize_tasks`, and moves the most urgent ones to **Next Actions** — all in one message.

**3. Run agents on tasks**
Assign a custom AI agent to any task. The agent reads the task context, executes it, and saves the output directly to the card for your review.

---

## Key Features

- **Natural language pipeline management** — create, move, reprioritize tasks through conversation
- **AI agent execution** — custom agents with their own identity and system prompt run tasks end-to-end
- **Real-time board sync** — every AI action reflects instantly via Supabase Realtime, no refresh needed
- **Human-in-the-loop by design** — agents cannot archive tasks; only you validate and close work
- **Conversational onboarding** — AI extracts your project context and bootstraps the workspace from scratch

---

## Agent System

Agents in Vela are AI workers you define. Each agent has:
- A **name** and **handle** (e.g. `@copywriter`)
- An **emoji** identifier visible on task cards
- A **system prompt** that defines its expertise and output format

When you assign an agent to a task and hit run, it receives the task title and description, executes against its system prompt, and saves the result — a draft, an analysis, a plan — directly to the task card.

Agents don't communicate with each other. They're independent specialists. You orchestrate them through the chat.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| AI | Vercel AI SDK + Anthropic Claude Sonnet |
| Database + Realtime | Supabase (PostgreSQL + WebSockets) |
| Styling | Tailwind CSS + custom design tokens |
| Validation | Zod |
| Deployment | Vercel |

**Architecture:** One monorepo. Frontend components in `src/components/`, API routes in `src/app/api/`, AI prompts centralized in `src/lib/agents.ts`.

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://app.supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key

### Setup

```bash
git clone https://github.com/your-username/vela
cd vela
npm install
cp .env.local.example .env.local
```

Fill in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-...
```

### Database

Run the latest migration in the Supabase SQL Editor:

```
supabase/schema.sql         ← initial schema
supabase/migration_002.sql  ← agents + workspaces
supabase/migration_003.sql  ← task results
supabase/migration_004.sql  ← project context
```

Enable **Realtime** on the `tasks` table in your Supabase dashboard.

### Run

```bash
npm run dev
# → http://localhost:3000
```

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts        # AI chat — streaming + tool calls
│   │   └── task/run/route.ts    # Agent task execution
│   └── workspace/[id]/page.tsx  # Main workspace
├── components/
│   ├── ChatPanel.tsx            # Conversational AI interface
│   ├── PipelineView.tsx         # Kanban board with 4 pipeline states
│   ├── TaskModal.tsx            # Task detail + agent result viewer
│   ├── AgentManager.tsx         # Create and manage custom agents
│   └── OnboardingPage.tsx       # First-run workspace setup
├── lib/
│   ├── agents.ts                # All AI system prompts (single source of truth)
│   ├── tokens.ts                # Design system tokens
│   └── supabase.ts              # Database client
└── types/
    └── database.ts              # TypeScript types
```

---

## AI Tools

The AI has access to 6 tools it can chain autonomously:

| Tool | What it does |
|---|---|
| `create_task` | Creates a task in the pipeline (defaults to backlog) |
| `reprioritize_tasks` | Promotes the most urgent tasks to Next Actions (max 5) |
| `update_task_status` | Moves a task between pipeline states |
| `delete_task` | Removes a task |
| `summarize_board` | Reads the full board state for analysis |
| `save_project_context` | Persists project context after onboarding |

---

## License

MIT
