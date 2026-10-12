import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, CircleAlert, Search, SlidersHorizontal } from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import type { ArchiveCase, ArchiveOverview } from "../lib/archive";
import { archivePeriod, coverClass, progressOf } from "../lib/archive";
import ArchiveArtwork from "../components/ArchiveArtwork";
import ArchivePreviewPanel from "../components/ArchivePreviewPanel";

export default function ArchiveCatalogPage() {
  const [cases, setCases] = useState<ArchiveCase[]>([]);
  const [overview, setOverview] = useState<ArchiveOverview | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("全部档案");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ArchiveCase | null>(null);
  const coverRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dismiss = (code: string) => {
    setSelected(null);
    coverRefs.current[code]?.focus({ preventScroll: true });
  };

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

  const rows = useMemo(() => Array.from({ length: Math.ceil(filtered.length / 2) }, (_, index) => filtered.slice(index * 2, index * 2 + 2)), [filtered]);

  return (
    <div className="archive-page archive-catalog-page space-y-6">
      <header className="archive-catalog-masthead">
        <div className="archive-catalog-masthead-copy">
          <div className="archive-eyebrow">THE COLLECTION / 馆藏目录</div>
          <h1 className="archive-catalog-title">打开历史档案</h1>
          <div className="archive-catalog-masthead-rule"><span>馆藏编号 · 01—{String(cases.length || 10).padStart(2, "0")}</span><span>循迹 / 求证 / 发现</span></div>
        </div>
        <div className="archive-catalog-stacks" aria-hidden="true">
          <div className="catalog-folder catalog-folder-back"><span className="catalog-folder-tab">改革</span><span className="catalog-folder-year">1978</span></div>
          <div className="catalog-folder catalog-folder-middle"><span className="catalog-folder-tab">建设</span><span className="catalog-folder-year">1956</span></div>
          <div className="catalog-folder catalog-folder-front"><span className="catalog-folder-tab">革命</span><div className="catalog-folder-label"><small>CHINA / FIELD ARCHIVES</small><strong>中国道路</strong><span>历史 · 实践 · 理论</span></div><span className="catalog-folder-stamp">馆藏</span></div>
        </div>
        <div className="archive-catalog-era-track" aria-label="历史脉络：革命、建设、改革与新时代"><span><b>1927</b><small>革命探索</small></span><i /><span><b>1956</b><small>建设起步</small></span><i /><span><b>1978</b><small>改革开放</small></span><i /><span><b>新时代</b><small>接续前行</small></span></div>
      </header>

      {error && <div role="alert" className="archive-error"><CircleAlert size={17} />{error}</div>}

      <div className="archive-catalog-toolbar">
      <div className="archive-catalog-search flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9e9384]" />
          <input className="archive-input !pl-11" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); }} aria-label="搜索档案" placeholder="搜索章节、理论或历史问题" />
        </div>
        <span className="flex items-center gap-2 text-xs text-[#958b7d]"><SlidersHorizontal size={15} /> 按历史阶段筛选</span>
      </div>
      <div className="archive-catalog-filters flex flex-wrap gap-2">
        {periods.map((period) => <button type="button" key={period} aria-pressed={active === period} onClick={() => { setActive(period); setSelected(null); }} className={"rounded-full px-4 py-2 text-xs font-medium transition " + (active === period ? "bg-[#2c4035] text-white" : "border border-[#dfd6c7] bg-white/60 text-[#71675b] hover:bg-white")}>{period}</button>)}
      </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-[#263a32]">馆藏档案 <span className="ml-2 font-sans text-xs font-normal tracking-[.16em] text-[#aa6a4e]">INDEX</span></h2>
        <span className="text-xs text-[#a09688]">{loading ? "整理中…" : filtered.length + " 份档案"}</span>
      </div>
      {loading ? <div className="grid gap-5 md:grid-cols-2">{[1, 2, 3, 4].map((n) => <div key={n} className="h-[290px] animate-pulse rounded-2xl bg-[#e3d9c9]" />)}</div> : filtered.length === 0 ? (
        <div className="archive-panel py-16 text-center"><Search className="mx-auto text-[#a69a8a]" /><h3 className="mt-3 font-serif text-xl text-[#34473b]">没有找到这份档案</h3><button className="mt-3 text-sm text-[#a8513a] underline" type="button" onClick={() => { setQuery(""); setActive("全部档案"); }}>查看全部</button></div>
      ) : (
        <div className="archive-catalog-grid">
          {rows.map((row) => {
            const expandedCode = row.some((item) => item.code === selected?.code) ? selected?.code : undefined;
            return <div className="archive-catalog-row" key={row.map((item) => item.code).join(":")}>
              {row.map((item) => {
                const index = cases.indexOf(item);
                const [chapter, ...subject] = item.chapter.split("·");
                const expanded = expandedCode === item.code;
                return <article key={item.code} className={"archive-catalog-item " + (expanded ? "is-expanded" : expandedCode ? "is-shelved" : "")} style={{ animationDelay: `${Math.min(index, 9) * 55}ms` }} onKeyDown={(event) => {
                  if (event.key === "Escape" && expanded) { event.preventDefault(); event.stopPropagation(); dismiss(item.code); }
                }}>
                  <div className="archive-catalog-spread">
                    <button type="button" ref={(node) => { coverRefs.current[item.code] = node; }} aria-label={"打开" + chapter.trim() + "档案介绍"} aria-expanded={expanded} aria-controls={expanded ? "archive-preview-" + item.code : undefined} className="archive-case-card archive-catalog-trigger" onClick={() => expanded ? dismiss(item.code) : setSelected(item)}>
                      <div className={"archive-catalog-cover archive-cover " + (coverClass[item.cover] ?? "")}>
                        <ArchiveArtwork kind={item.cover} className="archive-card-art" />
                        <span className="archive-catalog-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                        <div className="archive-catalog-chapter"><h3>{chapter.trim()}</h3><p className="archive-catalog-theme">{subject.join("·").trim()}</p><span>{expanded ? "点击收起" : "点击展开"}</span></div>
                        <span className="archive-catalog-open" aria-hidden="true"><ArrowUpRight size={20} /></span>
                      </div>
                    </button>
                    {expanded && <ArchivePreviewPanel archive={item} number={index + 1} progress={progressOf(overview?.items ?? [], item.code)} onDismiss={() => dismiss(item.code)} />}
                  </div>
                </article>;
              })}
            </div>;
          })}
        </div>
      )}
    </div>
  );
}
