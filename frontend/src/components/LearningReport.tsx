import { useEffect, useState } from "react";
import { ArrowUpRight, ChartNoAxesColumnIncreasing, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../lib/api";

interface ReportCase {
  case_code: string;
  title: string;
  status: "not_started" | "in_progress" | "completed";
}

interface Report {
  empty: boolean;
  completed_count: number;
  total_cases: number;
  first_attempt_rate: number | null;
  first_attempt_passed: number;
  first_attempt_sample: number;
  untracked_started_count: number;
  note_characters: number;
  chapters: { chapter: string; total: number; completed: number; completion_rate: number }[];
  timeline: { date: string; started: number; completed: number; note_characters: number }[];
  incomplete: ReportCase[];
  summary: string;
  commentary: string | null;
  commentary_mode: "offline" | "online";
  recommendations: string[];
}

export default function LearningReport() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    api.get<Report>("/archives/report")
      .then(({ data }) => { if (active) setReport(data); })
      .catch((reason) => { if (active) setError(apiErrorMessage(reason)); });
    return () => { active = false; };
  }, [version]);

  return <section className="archive-panel overflow-hidden" aria-labelledby="learning-report-title">
    <div className="border-b border-[#e3d9c8] bg-[#eee8db]/50 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="archive-eyebrow">LEARNING REPORT / 阶段回望</div>
        <ChartNoAxesColumnIncreasing size={22} className="text-[#a65b43]" />
      </div>
      <h2 id="learning-report-title" className="mt-3 font-serif text-2xl font-semibold text-[#2b3f33]">你的学习报告</h2>
      <p className="mt-3 text-sm leading-7 text-[#786d60]">{report?.summary ?? (error ? "暂时无法生成报告。" : "正在整理你的学习记录…")}</p>
    </div>
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 p-5 text-sm text-[#a6533d]">{error}<button type="button" className="inline-flex items-center gap-1 underline" onClick={() => setVersion((value) => value + 1)}><RefreshCw size={14} />重试</button></div>}
    {report && <div className="space-y-7 p-5 sm:p-7">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "档案完成", value: `${report.completed_count} / ${report.total_cases}`, detail: "教材主线与拓展专题" },
          { label: "线索一次通过率", value: report.first_attempt_rate === null ? "暂无记录" : `${Math.round(report.first_attempt_rate * 100)}%`, detail: `首次通过 ${report.first_attempt_passed} / ${report.first_attempt_sample} 份有效记录` },
          { label: "笔记字数", value: String(report.note_characters), detail: "已保存的当前文本，不含空白" },
        ].map((item) => <div key={item.label} className="rounded-xl border border-[#e4dac9] bg-[#fbf8f1] p-4"><div className="text-xs text-[#796d5e]">{item.label}</div><div className="mt-3 font-serif text-3xl font-semibold text-[#344c3b]">{item.value}</div><p className="mt-2 text-[11px] leading-5 text-[#8b7e6d]">{item.detail}</p></div>)}
      </div>
      {report.untracked_started_count > 0 && <p className="text-xs leading-6 text-[#8b7156]">有 {report.untracked_started_count} 份历史进度缺少完整尝试记录，未计入一次通过率。尚未核对线索的档案也不计入分母。</p>}
      <div className="grid gap-7 lg:grid-cols-2">
        <div>
          <h3 className="font-serif text-lg font-semibold text-[#344638]">章节完成度</h3>
          <div className="mt-4 space-y-3">{report.chapters.map((item) => <div key={item.chapter}>
            <div className="mb-1.5 flex items-start justify-between gap-3 text-xs leading-5"><span className="text-[#796e61]">{item.chapter}</span><span className="shrink-0 tabular-nums text-[#a45a41]">{item.completed}/{item.total}</span></div>
            <div role="progressbar" aria-label={item.chapter} aria-valuenow={item.completed} aria-valuemin={0} aria-valuemax={item.total} className="h-1.5 overflow-hidden rounded-full bg-[#e9e1d3]"><div className="h-full rounded-full bg-[#687f5d]" style={{ width: `${item.completion_rate * 100}%` }} /></div>
          </div>)}</div>
        </div>
        <div>
          <h3 className="font-serif text-lg font-semibold text-[#344638]">发现发生的日子</h3>
          <p className="mt-2 text-xs leading-6 text-[#8a7d6c]">按北京时间统计开启与首次完成日期；字数按首次完成日归集当前笔记，不代表当天写作量或学习时长。</p>
          {report.timeline.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-[#d9ccb7] p-6 text-sm leading-7 text-[#8a7c69]">开启第一份档案后，这里会留下你的探索足迹。</div> : <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">{report.timeline.map((day) => <div key={day.date} className="rounded-xl bg-[#f2ede3] p-3">
            <div className="flex flex-wrap justify-between gap-2 text-xs"><time dateTime={day.date} className="font-medium text-[#4c634b]">{day.date}</time><span className="text-[#8a745d]">笔记 {day.note_characters} 字</span></div>
            <div className="mt-2 flex items-center gap-3"><div className="h-1.5 flex-1 rounded-full bg-[#e2d8c6]"><div className="h-full rounded-full bg-[#b97550]" style={{ width: `${day.completed / report.total_cases * 100}%` }} /></div><span className="shrink-0 text-[11px] text-[#80715f]">开启 {day.started} · 完成 {day.completed}</span></div>
          </div>)}</div>}
        </div>
      </div>
      <div className="rounded-xl border border-[#d5ddcc] bg-[#edf1e7] p-4 sm:p-5">
        <h3 className="font-serif text-lg font-semibold text-[#40533d]">{report.commentary_mode === "online" ? "个性化学习建议" : "下一步探索"}</h3>
        {report.commentary ? <p className="mt-2 text-sm leading-7 text-[#65745b]">{report.commentary}</p> : <ul className="mt-2 space-y-1 text-sm leading-7 text-[#65745b]">{report.recommendations.map((item) => <li key={item}>{item}</li>)}</ul>}
      </div>
      {report.incomplete.length > 0 && <div>
        <h3 className="font-serif text-lg font-semibold text-[#344638]">待探索档案 <span className="ml-1 text-sm font-normal text-[#8d7e6b]">{report.incomplete.length} 份</span></h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{report.incomplete.map((item) => <Link key={item.case_code} to={`/archives/${item.case_code}`} className="flex items-center justify-between gap-3 rounded-lg border border-[#e0d7c7] p-3 text-xs leading-6 text-[#756857] transition hover:bg-[#f1e9db]"><span className="min-w-0"><span className="mr-2 text-[#a56045]">{item.status === "in_progress" ? "继续" : "开启"}</span>{item.title}</span><ArrowUpRight size={14} className="shrink-0" /></Link>)}</div>
      </div>}
    </div>}
  </section>;
}
