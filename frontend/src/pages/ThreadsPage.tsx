import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleAlert, Route } from "lucide-react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../lib/api";
import type { ThreadItem, ThreadOverview } from "../lib/archive";

export default function ThreadsPage() {
  const [overview, setOverview] = useState<ThreadOverview | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await api.get<ThreadOverview>("/archives/threads");
      setOverview(response.data);
      setDrafts(Object.fromEntries(response.data.items.map((item) => [item.thread, item.note])));
      setSaved({});
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveNote = async (item: ThreadItem) => {
    const note = (drafts[item.thread] ?? "").trim();
    if (note.length < 12) return;
    setBusy(item.thread);
    setError("");
    try {
      const response = await api.post<{ thread: string; note: string }>(
        `/archives/threads/${item.thread}/note`,
        { note },
      );
      setSaved((current) => ({ ...current, [item.thread]: response.data.note }));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy("");
    }
  };

  if (!overview) {
    return <div className="py-24 text-center text-sm text-[#8a8072]">{error || "正在翻阅主线档案…"}</div>;
  }

  return (
    <div className="archive-page space-y-6">
      <Link to="/archives" className="inline-flex items-center gap-1 text-xs font-medium text-[#7f766a] hover:text-[#a5523c]">
        <ArrowLeft size={15} /> 返回档案目录
      </Link>

      <header className="archive-panel p-6 sm:p-7">
        <div className="archive-eyebrow">FIELD THREADS</div>
        <h1 className="mt-2 flex items-center gap-2 font-serif text-[27px] font-semibold text-[#273a31]">
          <Route size={24} className="text-[#a8543d]" /> 档案主线
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#7d7264]">
          散落在各关卡片里的四组线索，会在通关后汇入这里。集齐一条主线的全部卡片，再用自己的话写下它的演变小结——
          看看「实事求是」「群众路线」「独立自主」「矛盾分析」是怎样被一代代人反复使用的。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#8a7b67]">
          <span className="archive-tag">已集齐主线 {overview.completed_threads} / {overview.total_threads}</span>
          <span>主线卡片只统计已经通关（并补全缺失卡）的关卡，未收集的卡片不会提前展示。</span>
        </div>
      </header>

      {error && <div role="alert" className="archive-error"><CircleAlert size={17} /> {error}</div>}

      <section className="grid gap-5 lg:grid-cols-2">
        {overview.items.map((item) => {
          const ratio = item.total > 0 ? item.collected / item.total : 0;
          const justSaved = saved[item.thread] !== undefined;
          return (
            <article key={item.thread} className="archive-panel flex flex-col p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] tracking-[.14em] text-[#aa624b]">主线 {item.thread}</div>
                  <h2 className="mt-1 font-serif text-xl font-semibold text-[#2e4034]">{item.name}</h2>
                </div>
                {item.unlocked ? (
                  <span className="archive-tag is-theory"><CheckCircle2 size={13} className="mr-1" /> 已集齐</span>
                ) : (
                  <span className="archive-tag">还差 {item.total - item.collected} 张</span>
                )}
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-[#9a8d7a]">
                  <span>收集进度</span>
                  <span>{item.collected} / {item.total}</span>
                </div>
                <div className="mt-1 h-1.5 rounded bg-[#efe6d6]">
                  <div
                    className={"h-1.5 rounded " + (item.unlocked ? "bg-[#5f8a63]" : "bg-[#c19a6b]")}
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 flex-1 space-y-3">
                {item.cards.map((card) => (
                  <div key={card.case_code + card.label} className="rounded-xl border border-[#e0d7c9] bg-[#fffcf5] p-3">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#9b7055]">
                      <span className="archive-tag is-context">{card.label}</span>
                      <span>{card.case_title}</span>
                    </div>
                    <p className="mt-2 text-xs leading-6 text-[#655e54]">{card.text}</p>
                    <p className="mt-1 text-[10px] text-[#9b7055]">出处：{card.source}</p>
                  </div>
                ))}
                {item.cards.length === 0 && (
                  <p className="rounded-xl border border-dashed border-[#d8cbb8] px-3 py-4 text-xs leading-6 text-[#a2968a]">
                    这条主线的卡片还没有开始收集。去档案关卡完成对应关卡，并补全被抽出的卡片，它们会出现在这里。
                  </p>
                )}
              </div>

              {item.collected > 0 && (
                <div className="mt-4 border-t border-[#e6dcc9] pt-4">
                  <label className="text-xs font-semibold text-[#33473a]" htmlFor={"thread-note-" + item.thread}>
                    {item.unlocked ? "主线小结" : "阶段小结（草稿）"}
                    <span className="ml-2 font-normal text-[#9a8d7a]">用一句话说说这条主线发生了什么变化（至少 12 字）</span>
                  </label>
                  <textarea
                    id={"thread-note-" + item.thread}
                    className="archive-input mt-2 min-h-16 resize-y"
                    maxLength={800}
                    value={drafts[item.thread] ?? ""}
                    onChange={(event) => setDrafts((current) => ({ ...current, [item.thread]: event.target.value }))}
                    placeholder="例如：从调查研究出发，这条线索在不同阶段都在回答『怎样从实际出发』……"
                  />
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      className="archive-button"
                      disabled={busy === item.thread || (drafts[item.thread] ?? "").trim().length < 12}
                      onClick={() => saveNote(item)}
                    >
                      {busy === item.thread ? "保存中…" : "保存小结"}
                    </button>
                    {busy !== item.thread && (justSaved || item.note) && (
                      <span className="text-xs text-[#5a7c56]">
                        {justSaved ? "已保存" : "已保存过小结"}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
