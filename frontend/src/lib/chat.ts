export interface ChatSession {
  id: number;
  title: string;
  case_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatStatus {
  available: boolean;
  model: string | null;
  message: string;
}

export interface ChatDetail {
  session: ChatSession;
  messages: ChatMessage[];
  has_more: boolean;
}

export interface ChatReply {
  session: ChatSession;
  messages: ChatMessage[];
}

export function chatDate(value: string): string {
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value + "Z");
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}
