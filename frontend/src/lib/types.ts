export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
}

export interface KnowledgePoint {
  id: number;
  code: string;
  name: string;
  chapter: string;
  summary: string;
  key_points: string[];
  quotes: { text: string; source: string }[];
  sources: string[];
  tags: string[];
  misconceptions: string[];
  application: string;
}
