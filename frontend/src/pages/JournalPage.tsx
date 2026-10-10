import { useEffect, useState } from "react";
import { ArrowRight, BookOpenText, CheckCircle2, CircleAlert, Clock3, NotebookPen } from "lucide-react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../lib/api";
import type { ArchiveCase, ArchiveOverview } from "../lib/archive";
import { progressOf } from "../lib/archive";
import LearningReport from "../components/LearningReport";

export default function JournalPage() {
  const [cases, setCases] = useState<ArchiveCase[]>([]);
  const [overview, setOverview] = useState<ArchiveOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    Promise.all([api.get<ArchiveCase[]>("/archives/cases"), api.get<ArchiveOverview>("/archives/progress")])
      .then(([caseResult, progressResult]) => { if (mounted) { setCases(caseResult.data); setOverview(progressResult.data); } })
      .catch((err) => { if (mounted) setError(apiErrorMessage(err)); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  const done = overview?.completed_count ?? 0;
  const next = cases.find((item) => !progressOf(overview?.items ?? [], item.code)?.completed_at);
  return (
    <div className="archive-page archive-journal-page space-y-8">
      <header className="archive-journal-header">
        <div className="archive-eyebrow">MY DISCOVERIES / 探索手册</div>
        <h1 className="mt-3 font-serif text-[34px] font-semibold text-[#263a32] sm:text-[42px]">我的发现</h1>
        <p className="mt-2 text-sm leading-7 text-[#83796d]">你读过的材料、串起的线索和写下的理解，都留在这里。</p>
        <div className="archive-journal-header-mark" aria-hidden="true">手记<br /><span>NO. 01</span></div>
      </header>
      {error && <div role="alert" className="archive-error"><CircleAlert size={17} />{error}</div>}
      <section className="archive-journal-intro grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_.8fr] lg:items-center">
        <div><div className="archive-eyebrow">JOURNEY PROGRESS</div><h2 className="mt-3 font-serif text-2xl font-semibold text-[#2b3f33]">你的理论探索之路</h2><p className="mt-3 text-sm leading-7 text-[#84796d]">每完成一份档案，就多理解一段理论与实践相遇的历史。</p><div className="mt-6 h-2 overflow-hidden rounded-full bg-[#e8dfd1]"><div className="h-full rounded-full bg-[#b65d42] transition-all" style={{ width: (cases.length ? done / cases.length * 100 : 0) + "%" }} /></div><p className="mt-2 text-xs text-[#958a7b]">已完成 {done} / {cases.length || "…"} 份档案</p></div>
        <div className="archive-journal-progress flex items-center justify-center gap-6 p-6"><span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#b76448] font-serif text-[34px] text-[#a9533c]">{done}</span><div><div className="font-serif text-xl font-semibold text-[#34483a]">份发现笔记</div><p className="mt-1 text-xs leading-6 text-[#847867]">不是标准答案，<br />是你自己的理解。</p></div></div>
      </section>

      <LearningReport />
      <section className="archive-journal-records">
        <div className="mb-4 flex items-end justify-between gap-3"><div><div className="archive-eyebrow">CHAPTER RECORDS</div><h2 className="mt-2 font-serif text-2xl font-semibold text-[#2c3f34]">章节足迹</h2></div><Link to="/archives" className="archive-text-link">继续探索 <ArrowRight size={15} /></Link></div>
        {loading ? <div className="archive-panel py-16 text-center text-sm text-[#918778]">正在整理探索手册…</div> : (
          <div className="archive-journal-lines space-y-3">
            {cases.map((item, index) => {
              const progress = progressOf(overview?.items ?? [], item.code);
              const finished = Boolean(progress?.completed_at);
              return <Link key={item.code} to={"/archives/" + item.code} className="archive-journal-record group flex items-start gap-4 p-4 transition hover:-translate-y-0.5 sm:items-center sm:gap-6 sm:p-5">
                <span className={"flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-serif text-xl " + (finished ? "bg-[#e6efe2] text-[#5a805b]" : "bg-[#efe7d9] text-[#a17b62]")}>{finished ? <CheckCircle2 size={22} /> : String(index + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1"><span className="text-[11px] tracking-[.12em] text-[#a2664d]">{item.chapter}</span><strong className="mt-1 block font-serif text-[17px] leading-6 text-[#304238]">{item.title}</strong>{finished ? <span className="mt-1 block line-clamp-2 text-xs leading-6 text-[#827769]">我的发现：{progress?.reflection}</span> : <span className="mt-1 flex items-center gap-1 text-xs text-[#948879]">{progress ? <><Clock3 size={12} /> 已开启，等待你的发现</> : <><BookOpenText size={12} /> 尚未打开</>}</span>}</span>
                <ArrowRight size={17} className="mt-3 shrink-0 text-[#a65b43] transition group-hover:translate-x-1 sm:mt-0" />
              </Link>;
            })}
          </div>
        )}
      </section>
      {!loading && done === 0 && <div className="archive-panel p-7 text-center"><NotebookPen className="mx-auto text-[#b15f45]" /><h2 className="mt-3 font-serif text-xl text-[#304239]">第一条发现正在等你</h2><p className="mt-2 text-sm text-[#8d8172]">选一份感兴趣的档案，从一张卡片开始。</p><Link to={next ? "/archives/" + next.code : "/archives"} className="archive-button mt-5">开始探索 <ArrowRight size={15} /></Link></div>}
    </div>
  );
}
