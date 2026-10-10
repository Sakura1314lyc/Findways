import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, BookOpenText, CheckCircle2, CircleAlert, Compass, Files, Route } from "lucide-react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../lib/api";
import type { ArchiveCase, ArchiveOverview } from "../lib/archive";
import { archiveLabel, coverClass, progressOf } from "../lib/archive";
import { useAuthStore } from "../stores/auth";
import ArchiveArtwork from "../components/ArchiveArtwork";

export default function ArchiveHomePage() {
  const user = useAuthStore((state) => state.user);
  const [cases, setCases] = useState<ArchiveCase[]>([]);
  const [overview, setOverview] = useState<ArchiveOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([api.get<ArchiveCase[]>("/archives/cases"), api.get<ArchiveOverview>("/archives/progress")])
      .then(([caseResult, progressResult]) => {
        if (active) { setCases(caseResult.data); setOverview(progressResult.data); }
      })
      .catch((err) => { if (active) setError(apiErrorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const done = overview?.completed_count ?? 0;
  const next = cases.find((item) => !progressOf(overview?.items ?? [], item.code)?.completed_at) ?? cases[0];
  const inspected = overview?.items.length ?? 0;
  return (
    <div className="archive-page archive-home-page space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="archive-eyebrow">中国道路档案馆 / THE PATH ARCHIVE</div>
          <h1 className="archive-welcome mt-3 font-serif text-[28px] font-semibold tracking-tight text-[#24362e] sm:text-[36px]">你好，<span className="break-all">{user?.username ?? "探索者"}</span>。</h1>
          <p className="mt-2 text-sm leading-7 text-[#766e60]">翻开档案，沿着历史线索，发现理论形成的过程。</p>
        </div>
        <Link to="/archives" className="archive-text-link">查看全部档案 <ArrowUpRight size={16} /></Link>
      </header>

      {error && <div role="alert" className="archive-error"><CircleAlert size={17} />{error}<button className="ml-auto underline" onClick={() => location.reload()}>重试</button></div>}

      <section className="archive-hero archive-home-hero relative overflow-hidden rounded-[24px] p-6 text-white sm:p-9">
        <div className="archive-hero-lines absolute inset-0" />
        <div className="relative z-10 grid gap-6 md:grid-cols-[1.1fr_.9fr] md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-[11px] tracking-[.16em] text-[#e6d2b6]"><Compass size={14} /> 循着线索，读懂来路</span>
            <h2 className="mt-5 max-w-[660px] font-serif text-[32px] font-semibold leading-[1.45] sm:text-[42px]">每一个理论，<br /><span className="text-[#edc995]">都有它来时的路。</span></h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-[#d2d6cc]">走进历史现场，在一份份档案中，<br className="hidden sm:block" />连接中国实践与理论形成的线索。</p>
            <Link to={next ? "/archives/" + next.code : "/archives"} className="mt-6 inline-flex min-h-12 items-center gap-3 rounded-xl bg-[#e9c798] px-5 text-sm font-semibold text-[#24362e] transition hover:bg-[#f4d9af]">
              {done === 0 ? "开启第一份档案" : done === cases.length && cases.length ? "重访档案馆" : "继续探索"} <ArrowRight size={18} />
            </Link>
          </div>
          <div className="archive-folio hidden md:block" aria-hidden="true">
            <div className="archive-folio-sheet">
              <div className="flex items-center justify-between border-b border-[#b5a88e]/60 pb-3 text-[9px] tracking-[.18em]"><span>寻路 · 探索手记</span><span>NO. 001</span></div>
              <ArchiveArtwork kind="road" className="my-3 text-[#63715b]" />
              <div className="flex items-end justify-between"><div><div className="font-serif text-2xl font-semibold">答案，藏在线索里。</div><div className="mt-2 text-[10px] tracking-[.18em] text-[#877c69]">国情 / 实践 / 理论</div></div><span className="archive-folio-stamp">寻路</span></div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="探索进度" className="archive-stats grid grid-cols-3">
        {[
          { icon: Files, label: "课程档案", value: loading ? "…" : cases.length, unit: "份", note: "沿着课程主线探索" },
          { icon: CheckCircle2, label: "已完成探索", value: loading ? "…" : done, unit: "份", note: "每份都留下你的发现" },
          { icon: Route, label: "已开启档案", value: loading ? "…" : inspected, unit: "份", note: "随时继续未完成的关卡" },
        ].map(({ icon: Icon, label, value, unit, note }) => (
          <div key={label} className="min-w-0 p-3 sm:px-6 sm:py-4">
            <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-medium text-[#756c60] sm:text-xs">{label}</span><Icon size={16} className="hidden text-[#b05a40] sm:block" /></div>
            <div className="mt-3 font-serif text-[34px] font-semibold text-[#263a32]">{value}<span className="ml-1 text-sm font-normal text-[#9c9386]">{unit}</span></div>
            <p className="mt-1 hidden text-xs text-[#857b6c] sm:block">{note}</p>
          </div>
        ))}
      </section>

      {cases.length > 0 && <section className="archive-journey archive-home-map" aria-label="课程探索路线">
        <div className="mb-4 flex items-center justify-between"><div className="archive-eyebrow">你的探索路线</div><span className="text-xs text-[#8a7f70]">{done} / {cases.length} 已完成</span></div>
        <div className="archive-journey-track">
          {cases.map((item, index) => {
            const finished = Boolean(progressOf(overview?.items ?? [], item.code)?.completed_at);
            return <Link key={item.code} to={"/archives/" + item.code} className={"archive-journey-stop " + (finished ? "is-complete" : next?.code === item.code ? "is-current" : "")} title={item.title}><span className="archive-journey-node">{finished ? <CheckCircle2 size={16} /> : String(index + 1).padStart(2, "0")}</span><span className="mt-2 block text-[11px] leading-5">{archiveLabel(item)}</span></Link>;
          })}
        </div>
      </section>}

      <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <div>
          <div className="mb-4 flex items-end justify-between">
            <div><div className="archive-eyebrow">YOUR NEXT CASE</div><h2 className="mt-2 font-serif text-2xl font-semibold text-[#263a32]">下一份档案</h2></div>
            <span className="text-xs text-[#978d7e]">{done} / {cases.length} 已完成</span>
          </div>
          {next ? (
            <Link to={"/archives/" + next.code} className={"archive-cover group flex min-h-[245px] flex-col justify-between overflow-hidden rounded-[23px] p-6 text-white transition hover:-translate-y-1 " + (coverClass[next.cover] ?? "")}>
              <div className="flex items-start justify-between"><span className="archive-cover-label">{next.chapter}</span><span className="font-serif text-3xl text-white/55">{String(cases.indexOf(next) + 1).padStart(2, "0")}</span></div>
              <div><span className="text-xs tracking-[.16em] text-white/75">{next.era}</span><h3 className="mt-2 font-serif text-2xl font-semibold sm:text-3xl">{next.title}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-white/75">{next.mission}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">打开档案 <ArrowRight size={16} className="transition group-hover:translate-x-1" /></span></div>
            </Link>
          ) : <div className="archive-panel py-16 text-center text-sm text-[#9a9080]">{loading ? "正在整理档案…" : "暂时没有可探索的档案"}</div>}
        </div>
        <div className="archive-home-guide p-6">
          <div className="archive-eyebrow">HOW IT WORKS</div>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-[#263a32]">一份档案，三步发现</h2>
          <div className="mt-6 space-y-6">
            {[
              ["01", "阅读档案", "观察史料线索与当时的问题。"],
              ["02", "整理线索", "按历史条件、实践探索、理论形成连起材料。"],
              ["03", "写下发现", "用自己的话解释理论为何出现。"],
            ].map(([number, title, body]) => (
              <div key={number} className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f2e3cb] font-serif text-sm text-[#9b573e]">{number}</span><div><h3 className="text-sm font-semibold text-[#293c33]">{title}</h3><p className="mt-1 text-xs leading-6 text-[#8b8274]">{body}</p></div></div>
            ))}
          </div>
          <Link to="/knowledge" className="mt-7 inline-flex items-center gap-2 border-t border-[#e6ded1] pt-5 text-sm font-medium text-[#a64e37]"><BookOpenText size={17} /> 先翻翻理论手册 <ArrowRight size={15} /></Link>
        </div>
      </section>
    </div>
  );
}
