export type TaskStatus = "backlog" | "todo" | "in_progress" | "done";

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  user_profile: string | null;
  objective: string | null;
  constraints: string | null;
  emoji: string;
  created_at: string;
}
export type AssigneeType = "human" | "ai_agent_name";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee_type: AssigneeType;
  assigned_agent_id: string | null;
  created_by_agent_id: string | null;
  result: string | null;
  user_notes: string | null;
  due_date: string | null;
  position: number;
  workspace_id: string | null;
  created_at: string;
}

export interface CustomAgent {
  id: string;
  name: string;
  handle: string;
  emoji: string;
  color: string;
  system_prompt: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  chat_agent_id: string;
  created_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}
