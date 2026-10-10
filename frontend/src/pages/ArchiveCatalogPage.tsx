import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, CircleAlert, Search, SlidersHorizontal, Archive, MoveUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../lib/api";
import type { ArchiveCase, ArchiveOverview } from "../lib/archive";
import { archivePeriod, coverClass, progressOf } from "../lib/archive";
import ArchiveArtwork from "../components/ArchiveArtwork";

export default function ArchiveCatalogPage() {
  const [cases, setCases] = useState<ArchiveCase[]>([]);
  const [overview, setOverview] = useState<ArchiveOverview | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("全部档案");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([api.get<ArchiveCase[]>("/archives/cases"), api.get<ArchiveOverview>("/archives/progress")])
      .then(([caseResult, progressResult]) => {
        if (mounted) { setCases(caseResult.data); setOverview(progressResult.data); }
      })
      .catch((err) => { if (mounted) setError(apiErrorMessage(err)); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const periods = ["全部档案", "革命", "建设", "改革", "新时代拓展", "综合关"];
  const filtered = useMemo(() => cases.filter((item) => {
    const inPeriod = active === "全部档案" || archivePeriod(item) === active;
    const term = query.trim().toLowerCase();
    return inPeriod && (!term || [item.title, item.chapter, item.mission, item.theory_name].some((text) => text.toLowerCase().includes(term)));
  }), [active, cases, query]);

  return (
    <div className="archive-page archive-catalog-page space-y-6">
      <header className="archive-catalog-masthead">
        <div className="archive-catalog-masthead-copy">
          <div className="archive-eyebrow !text-[#e8c89c]">THE COLLECTION / 馆藏目录</div>
          <h1 className="mt-4 font-serif text-[34px] font-semibold text-white sm:text-[44px]">打开历史档案</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#e6decf]">{cases.length || "…"} 份档案，串联教材八章与新时代拓展专题，找出理论形成的线索。</p>
          <div className="archive-catalog-masthead-rule"><span>馆藏编号 · 01—{String(cases.length || 10).padStart(2, "0")}</span><span>循迹 / 求证 / 发现</span></div>
        </div>
        <div className="archive-catalog-object" aria-hidden="true"><Archive size={88} strokeWidth={.8} /><span>寻路<br />档案馆</span></div>
      </header>

      {error && <div role="alert" className="archive-error"><CircleAlert size={17} />{error}</div>}

      <div className="archive-catalog-search flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9e9384]" />
          <input className="archive-input !pl-11" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜索档案" placeholder="搜索章节、理论或历史问题" />
        </div>
        <span className="flex items-center gap-2 text-xs text-[#958b7d]"><SlidersHorizontal size={15} /> 按历史阶段筛选</span>
      </div>
      <div className="archive-catalog-filters flex flex-wrap gap-2">
        {periods.map((period) => <button type="button" key={period} onClick={() => setActive(period)} className={"rounded-full px-4 py-2 text-xs font-medium transition " + (active === period ? "bg-[#2c4035] text-white" : "border border-[#dfd6c7] bg-white/60 text-[#71675b] hover:bg-white")}>{period}</button>)}
      </div>

      <div className="flex items-end justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-[#263a32]">馆藏档案 <span className="ml-2 font-sans text-xs font-normal tracking-[.16em] text-[#aa6a4e]">INDEX</span></h2>
        <span className="text-xs text-[#a09688]">{loading ? "整理中…" : filtered.length + " 份档案"}</span>
      </div>
      {loading ? <div className="grid gap-5 md:grid-cols-2">{[1, 2, 3, 4].map((n) => <div key={n} className="h-[290px] animate-pulse rounded-2xl bg-[#e3d9c9]" />)}</div> : filtered.length === 0 ? (
        <div className="archive-panel py-16 text-center"><Search className="mx-auto text-[#a69a8a]" /><h3 className="mt-3 font-serif text-xl text-[#34473b]">没有找到这份档案</h3><button className="mt-3 text-sm text-[#a8513a] underline" type="button" onClick={() => { setQuery(""); setActive("全部档案"); }}>查看全部</button></div>
      ) : (
        <div className="archive-catalog-grid grid gap-5 md:grid-cols-2">
          {filtered.map((item) => {
            const index = cases.indexOf(item);
            const progress = progressOf(overview?.items ?? [], item.code);
            const status = progress?.completed_at ? "已完成" : progress ? "探索中" : "待开启";
            return (
              <Link key={item.code} to={"/archives/" + item.code} className="archive-case-card archive-catalog-item group overflow-hidden rounded-[14px]" style={{ animationDelay: `${Math.min(index, 9) * 55}ms` }}>
                <div className={"archive-cover archive-illustrated-cover relative flex h-[190px] items-start justify-between overflow-hidden p-5 text-white " + (coverClass[item.cover] ?? "")}>
                  <ArchiveArtwork kind={item.cover} className="archive-card-art" />
                  <span className="archive-cover-label">{item.era}</span>
                  <span className="font-serif text-5xl text-white/50">{String(index + 1).padStart(2, "0")}</span>
                  <div className="absolute bottom-4 left-5 text-xs tracking-[.12em] text-white/80">{item.chapter}</div>
                </div>
                <div className="archive-catalog-item-body p-5">
                  <div className="flex items-center justify-between gap-2"><span className="text-[11px] tracking-[.12em] text-[#b05d42]">档案 NO.{String(cases.indexOf(item) + 1).padStart(2, "0")}</span><span className={"rounded-full px-2.5 py-1 text-[11px] " + (progress?.completed_at ? "bg-[#e6efe2] text-[#567553]" : progress ? "bg-[#f4ead6] text-[#a4763f]" : "bg-[#f2eee6] text-[#938879]")}>{progress?.completed_at && <Check size={11} className="mr-1 inline" />}{status}</span></div>
                  <h3 className="mt-3 font-serif text-[22px] font-semibold leading-8 text-[#263b31]">{item.title}</h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-[#81776a]">{item.subtitle}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-[#e8dece] pt-4 text-xs font-semibold text-[#a9523b]"><span>{progress?.completed_at ? "再次阅读" : progress ? "继续探索" : "打开档案"}</span>{index === 0 ? <MoveUpRight size={16} className="transition group-hover:translate-x-1" /> : <ArrowRight size={16} className="transition group-hover:translate-x-1" />}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
