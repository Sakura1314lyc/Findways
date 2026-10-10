import { useEffect, useMemo, useState } from "react";
import { BookOpenText, ChevronDown, CircleAlert, Search } from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import type { ArchiveCase } from "../lib/archive";
import type { KnowledgePoint } from "../lib/types";

export default function ArchiveKnowledgePage() {
  const [cases, setCases] = useState<ArchiveCase[]>([]);
  const [points, setPoints] = useState<KnowledgePoint[]>([]);
  const [query, setQuery] = useState("");
  const [chapter, setChapter] = useState("全部");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    Promise.all([api.get<ArchiveCase[]>("/archives/cases"), api.get<KnowledgePoint[]>("/knowledge/points")])
      .then(([caseResult, pointResult]) => { if (mounted) { setCases(caseResult.data); setPoints(pointResult.data); } })
      .catch((err) => { if (mounted) setError(apiErrorMessage(err)); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  const allowed = useMemo(() => new Set(cases.flatMap((item) => item.theory_codes)), [cases]);
  const coursePoints = useMemo(() => points.filter((item) => allowed.has(item.code)), [allowed, points]);
  const chapters = useMemo(() => [...new Set(coursePoints.map((item) => item.chapter))], [coursePoints]);
  const visible = useMemo(() => coursePoints.filter((item) => {
    const term = query.trim().toLowerCase();
    return (chapter === "全部" || item.chapter === chapter) && (!term || [item.name, item.summary, item.application].some((text) => text.toLowerCase().includes(term)));
  }), [coursePoints, chapter, query]);
  return (
    <div className="archive-page archive-knowledge-page space-y-7">
      <header className="archive-knowledge-header">
        <div><div className="archive-eyebrow">THEORY FIELD GUIDE / 理论手册</div><h1 className="mt-3 font-serif text-[34px] font-semibold text-[#263a32] sm:text-[42px]">理论手册</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-[#81776a]">围绕档案关卡整理毛概课程知识点。先读历史情境，再回到教材理解概念。</p></div>
        <div className="archive-knowledge-book" aria-hidden="true"><span>寻路</span><strong>理论<br />手册</strong><small>THEORY FIELD GUIDE</small></div>
      </header>
      {error && <div role="alert" className="archive-error"><CircleAlert size={17} />{error}</div>}
      <div className="archive-knowledge-search p-5">
        <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9a8e7e]" size={18} /><input aria-label="搜索理论" className="archive-input !pl-11" placeholder="搜索理论名称、关键词或应用场景" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {["全部", ...chapters].map((item) => <button type="button" key={item} onClick={() => setChapter(item)} className={"shrink-0 rounded-full px-3 py-2 text-xs transition " + (chapter === item ? "bg-[#2c4035] text-white" : "bg-[#f3eee5] text-[#71695e] hover:bg-[#ebe2d3]")}>{item}</button>)}
        </div>
      </div>
      <div className="flex items-end justify-between"><h2 className="font-serif text-xl font-semibold text-[#2c4035]">核心知识点</h2><span className="text-xs text-[#968b7c]">{loading ? "整理中…" : visible.length + " 个条目"}</span></div>
      {loading ? <div className="archive-panel py-16 text-center text-sm text-[#8f8374]">正在翻阅理论手册…</div> : visible.length === 0 ? <div className="archive-panel py-16 text-center text-sm text-[#8f8374]">没有找到相关条目，换个关键词试试。</div> : (
        <div className="archive-knowledge-index grid gap-3">
          {visible.map((point, index) => {
            const open = expanded === point.code;
            return <article key={point.code} className={"archive-knowledge-entry overflow-hidden " + (open ? "is-open" : "")}>
              <button type="button" aria-expanded={open} className="flex w-full items-start gap-4 p-5 text-left sm:p-6" onClick={() => setExpanded(open ? null : point.code)}>
                <span className="archive-knowledge-entry-number hidden h-10 w-10 shrink-0 items-center justify-center font-serif text-[#a36147] sm:flex">{String(index + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1"><span className="text-[11px] tracking-[.1em] text-[#a75a40]">{point.chapter}</span><strong className="mt-1 block font-serif text-xl text-[#2c3f34]">{point.name}</strong><span className="mt-2 block text-sm leading-7 text-[#817568]">{point.summary}</span></span>
                <ChevronDown className={"mt-2 shrink-0 text-[#9a8c7c] transition " + (open ? "rotate-180" : "")} size={18} />
              </button>
              {open && <div className="border-t border-[#eee5d8] bg-[#fffcf6] px-5 pb-6 pt-5 sm:px-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div><div className="text-xs font-semibold text-[#a55840]">理解要点</div><ul className="mt-3 space-y-2 text-sm leading-6 text-[#695f53]">{point.key_points.map((text) => <li key={text} className="flex gap-2"><span className="text-[#b56b4a]">•</span>{text}</li>)}</ul></div>
                  <div><div className="text-xs font-semibold text-[#a55840]">结合实践</div><p className="mt-3 text-sm leading-7 text-[#695f53]">{point.application}</p>{point.sources.length > 0 && <p className="mt-4 text-[11px] leading-5 text-[#9a8d7c]">参考：{point.sources.join("、")}</p>}</div>
                </div>
              </div>}
            </article>;
          })}
        </div>
      )}
      <div className="flex items-start gap-2 rounded-xl bg-[#ece8db] p-4 text-xs leading-6 text-[#82786a]"><BookOpenText size={16} className="mt-1 shrink-0" />本手册用于辅助关卡探究；章节和术语以课程教材及授课要求为准。</div>
    </div>
  );
}
