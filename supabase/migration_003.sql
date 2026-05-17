-- Add created_by_agent_id to tasks: tracks which custom agent created the task via chat
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS created_by_agent_id UUID REFERENCES custom_agents(id) ON DELETE SET NULL;
