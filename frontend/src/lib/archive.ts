export type CardStage = "context" | "practice" | "theory";
export type CardPlacement = CardStage | "reject";

export interface ArchiveCard {
  id: string;
  label: string;
  text: string;
  source: string;
  stage?: CardStage | "distractor" | "timeline";
  variant?: string;
  reject_reason?: string;
  thread?: string | null;
  year?: string;
}

export interface ArchiveProbe {
  question: string;
  reference?: string;
  keywords?: string[];
}

export interface ArchiveTransferOption {
  key: string;
  text: string;
}

export interface ArchiveTransfer {
  scenario: string;
  options: ArchiveTransferOption[];
  answer?: string;
  rationale?: string;
}

export interface FillBlank {
  card_id: string;
  label: string;
  text: string | null;
  source: string | null;
  points: string[] | null;
}

export interface ChainOption {
  id: string;
  label: string;
}

export interface ChainEdge {
  child_id: string;
  child_label: string;
  options: ChainOption[];
}

export interface ChainEdgeResult {
  child_id: string;
  child_label: string;
  chosen_id: string;
  chosen_label: string;
  correct: boolean;
  accepted: ChainOption[];
}

export interface ChainResult {
  results: ChainEdgeResult[];
  correct_count: number;
  total: number;
  passed: boolean;
}

export interface FillResult {
  correct: boolean;
  hit: string[];
  points: string[];
  card: { id: string; label: string; text: string; source: string };
}

export interface ThreadCard {
  case_code: string;
  case_title: string;
  case_chapter: string;
  label: string;
  text: string;
  source: string;
}

export interface ThreadItem {
  thread: string;
  name: string;
  total: number;
  collected: number;
  unlocked: boolean;
  note: string;
  cards: ThreadCard[];
}

export interface ThreadOverview {
  items: ThreadItem[];
  total_threads: number;
  completed_threads: number;
}

export interface ThreadMapOption {
  key: string;
  name: string;
}

export interface ThreadMapPayload {
  options: ThreadMapOption[];
  cards: { id: string; label: string }[];
}

export interface ThreadMapEntry {
  card_id: string;
  label: string;
  chosen: string;
  answer: string;
  correct: boolean;
}

export interface ThreadMapResult {
  results: ThreadMapEntry[];
  correct_count: number;
  total: number;
  passed: boolean;
}

export interface TimelineResult {
  mode: "timeline";
  correct: boolean;
  passed: boolean;
  score: number;
  earned: number;
  total: number;
  position_hits: number;
  position_total: number;
  triage_correct: number;
  triage_total: number;
  mistakes: CheckMistake[];
  hint: string;
  hint_remaining: number;
  attempts: number;
  best_score: number;
  hints_used: number;
}

export interface ArchiveCase {
  code: string;
  chapter: string;
  era: string;
  title: string;
  subtitle: string;
  mission: string;
  cover: string;
  theory_name: string;
  theory_codes: string[];
  theory_summary?: string;
  reflection_prompt?: string;
  cards?: ArchiveCard[];
  card_total?: number;
  hint_total?: number;
  hints?: string[];
  probes?: ArchiveProbe[];
  transfer?: ArchiveTransfer;
  stages?: CardStage[];
  pass_line?: number;
  fill_blank?: FillBlank;
  chain_edges?: ChainEdge[];
  mode?: string;
  timeline_total?: number;
  thread_map?: ThreadMapPayload;
}

export interface CheckMistake {
  id: string;
  label: string;
  kind: "stage" | "order" | "triage";
}

export interface CheckResult {
  mode: string;
  correct: boolean;
  passed: boolean;
  score: number;
  earned: number;
  total: number;
  stage_correct: number;
  stage_total: number;
  triage_correct: number;
  triage_total: number;
  mistakes: CheckMistake[];
  hint: string;
  hint_remaining: number;
  attempts: number;
  best_score: number;
  hints_used: number;
}

export interface HintResult {
  hint: string;
  remaining: number;
  exhausted: boolean;
  hints_used: number;
}

export interface ProbeResult {
  question: string;
  correct: boolean;
  hit: string[];
  reference: string;
}

export interface ProbeResponse {
  results: ProbeResult[];
  probe_passed: boolean;
  answered_all: boolean;
}

export interface TransferResult {
  correct: boolean;
  answer: string;
  rationale: string;
}

export interface ArchiveProgress {
  case_code: string;
  clues_solved: boolean;
  reflection: string;
  completed_at: string | null;
  created_at: string;
  attempts: number;
  hints_used: number;
  best_score: number;
  passed_at: string | null;
  probe_passed: boolean;
  placements: Record<string, CardPlacement>;
  probe_results: ProbeResult[];
  transfer_result?: (TransferResult & { option: string; reason: string }) | null;
  chain_result?: ChainResult | null;
  fill_result?: FillResult | null;
  timeline_result?: TimelineResult | null;
  thread_map_result?: ThreadMapResult | null;
  submitted_order?: string[];
  submitted_rejected?: string[];
}

export interface ArchiveOverview {
  total_cases: number;
  completed_count: number;
  items: ArchiveProgress[];
}

export const coverClass: Record<string, string> = {
  method: "cover-method",
  road: "cover-road",
  transform: "cover-transform",
  industry: "cover-industry",
  reform: "cover-reform",
  people: "cover-people",
  development: "cover-development",
};

export const stageMeta: Record<CardStage, { label: string; hint: string }> = {
  context: { label: "历史条件", hint: "当时面对什么问题？" },
  practice: { label: "实践探索", hint: "人们做了怎样的尝试？" },
  theory: { label: "理论形成", hint: "从实践中获得什么认识？" },
};

export const threadMeta: Record<string, string> = {
  A: "实事求是",
  B: "群众路线",
  C: "独立自主",
  D: "矛盾分析",
};

export const rejectLabel = "不属于本关";

export function progressOf(items: ArchiveProgress[], code: string) {
  return items.find((item) => item.case_code === code);
}

export function archivePeriod(item: ArchiveCase) {
  if (item.chapter.startsWith("拓展")) return "新时代拓展";
  if (item.chapter.startsWith("综合")) return "综合关";
  if (/^第[一二]章/.test(item.chapter)) return "革命";
  if (/^第[三四]章/.test(item.chapter)) return "建设";
  return "改革";
}

export function archiveLabel(item: ArchiveCase) {
  const labels: Record<string, string> = {
    seek_truth: "思想方法", rural_road: "革命道路", socialist_transformation: "社会主义改造",
    construction_exploration: "建设探索", theory_development: "理论接续", market_reform: "改革开放",
    three_representatives: "党的建设", scientific_development: "科学发展",
    new_era_contradiction: "美好生活", chinese_modernization: "现代化之路", grand_road: "综合串讲",
  };
  return labels[item.code] ?? item.theory_name;
}

export function cardStatusLabel(placement: CardPlacement | undefined) {
  if (!placement) return "";
  if (placement === "reject") return rejectLabel;
  return stageMeta[placement].label;
}
