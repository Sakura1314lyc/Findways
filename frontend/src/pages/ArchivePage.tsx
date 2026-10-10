import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpenText, Check, CheckCircle2, CircleAlert, Compass, Lightbulb, RotateCcw, Sparkles } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api, apiErrorMessage } from "../lib/api";
import type {
  ArchiveCard, ArchiveCase, ArchiveProgress, CardPlacement, ChainResult, CheckResult, FillResult, HintResult,
  ProbeResponse, ThreadMapResult, TimelineResult, TransferResult,
} from "../lib/archive";
import { cardStatusLabel, coverClass, rejectLabel, stageMeta, threadMeta } from "../lib/archive";
import ArchiveArtwork from "../components/ArchiveArtwork";
import ArchiveAgentPanel from "../components/ArchiveAgentPanel";
import { useAuthStore } from "../stores/auth";

const stageOrder: ("context" | "practice" | "theory")[] = ["context", "practice", "theory"];
const options: { key: CardPlacement; label: string; tone: string }[] = [
  { key: "context", label: "历史条件", tone: "is-context" },
  { key: "practice", label: "实践探索", tone: "is-practice" },
  { key: "theory", label: "理论形成", tone: "is-theory" },
  { key: "reject", label: rejectLabel, tone: "is-reject" },
];

export default function ArchivePage() {
  const { code } = useParams();
  const userId = useAuthStore((state) => state.user?.id);
  const draftKey = "xunlu-note:" + userId + ":" + code;
  const [caseData, setCaseData] = useState<ArchiveCase | null>(null);
  const [progress, setProgress] = useState<ArchiveProgress | null>(null);
  const [placements, setPlacements] = useState<Record<string, CardPlacement>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [hint, setHint] = useState<HintResult | null>(null);
  const [note, setNote] = useState("");
  const [probeAnswers, setProbeAnswers] = useState<Record<string, string>>({});
  const [probeResponse, setProbeResponse] = useState<ProbeResponse | null>(null);
  const [transferOption, setTransferOption] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferResponse, setTransferResponse] = useState<TransferResult | null>(null);
  const [chainLinks, setChainLinks] = useState<Record<string, string>>({});
  const [chainResult, setChainResult] = useState<ChainResult | null>(null);
  const [fillAnswer, setFillAnswer] = useState("");
  const [fillResult, setFillResult] = useState<FillResult | null>(null);
  const [timelineOrder, setTimelineOrder] = useState<string[]>([]);
  const [timelineResult, setTimelineResult] = useState<TimelineResult | null>(null);
  const [threadMap, setThreadMap] = useState<Record<string, string>>({});
  const [threadMapResult, setThreadMapResult] = useState<ThreadMapResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setError("");
    try {
      const [caseResult, progressResult] = await Promise.all([
        api.get<ArchiveCase>("/archives/cases/" + code),
        api.post<ArchiveProgress>("/archives/cases/" + code + "/start"),
      ]);
      setCaseData(caseResult.data);
      setProgress(progressResult.data);
      setPlacements(progressResult.data.placements ?? {});
      setProbeResponse(
        progressResult.data.probe_results?.length
          ? { results: progressResult.data.probe_results, probe_passed: progressResult.data.probe_passed, answered_all: true }
          : null,
      );
      const stored = progressResult.data.transfer_result;
      setTransferResponse(stored ? { correct: stored.correct, answer: stored.answer, rationale: stored.rationale } : null);
      setTransferOption(stored?.option ?? "");
      setTransferReason(stored?.reason ?? "");
      const storedChain = progressResult.data.chain_result ?? null;
      setChainResult(storedChain);
      setChainLinks(
        storedChain
          ? Object.fromEntries(storedChain.results.map((item) => [item.child_id, item.chosen_id]))
          : {},
      );
      setFillResult(progressResult.data.fill_result ?? null);
      setFillAnswer("");
      setTimelineOrder(progressResult.data.submitted_order ?? []);
      setTimelineResult(progressResult.data.timeline_result ?? null);
      const storedMap = progressResult.data.thread_map_result ?? null;
      setThreadMapResult(storedMap);
      setThreadMap(
        storedMap
          ? Object.fromEntries(storedMap.results.map((item) => [item.card_id, item.chosen]))
          : {},
      );
      let draft: string | null = null;
      try { draft = sessionStorage.getItem(draftKey); } catch { /* Storage may be disabled. */ }
      setNote(draft ?? progressResult.data.reflection ?? "");
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setLoading(false); }
  }, [code, draftKey]);

  useEffect(() => { setCaseData(null); setPlacements({}); setResult(null); setHint(null); void load(); }, [load]);

  useEffect(() => {
    if (!caseData || caseData.code !== code || !progress) return;
    try {
      if (note !== progress.reflection) sessionStorage.setItem(draftKey, note);
      else sessionStorage.removeItem(draftKey);
    } catch { /* The editor works without storage. */ }
  }, [caseData, code, draftKey, note, progress]);

  const cards = useMemo(() => caseData?.cards ?? [], [caseData]);
  const solved = progress?.clues_solved ?? false;
  const completed = Boolean(progress?.completed_at);
  const timelineMode = caseData?.mode === "timeline";
  const assigned = useMemo(() => new Set(Object.keys(placements)), [placements]);
  const rejectedIds = useMemo(
    () => cards.filter((card) => placements[card.id] === "reject").map((card) => card.id),
    [cards, placements],
  );
  const missingReasons = useMemo(
    () => cards.filter((card) => placements[card.id] === "reject" && (reasons[card.id] ?? "").trim().length < 4),
    [cards, placements, reasons],
  );
  const readyToCheck = cards.length > 0 && assigned.size === cards.length;
  const handledCount = timelineOrder.length + rejectedIds.length;
  const timelineReady = cards.length > 0 && handledCount === cards.length;

  const placeOnTimeline = (cardId: string) => {
    if (solved) return;
    setTimelineResult(null);
    setMessage("");
    setTimelineOrder((current) => (current.includes(cardId) ? current : [...current, cardId]));
    setPlacements((current) => {
      const next = { ...current };
      delete next[cardId];
      return next;
    });
    setActiveCard(null);
  };

  const rejectCard = (cardId: string) => {
    if (solved) return;
    setTimelineResult(null);
    setMessage("");
    setTimelineOrder((current) => current.filter((item) => item !== cardId));
    setPlacements((current) => ({ ...current, [cardId]: "reject" }));
    setActiveCard(cardId);
  };

  const removeFromTimeline = (cardId: string) => {
    setTimelineResult(null);
    setTimelineOrder((current) => current.filter((item) => item !== cardId));
  };

  const timelineIndex = (cardId: string) => timelineOrder.indexOf(cardId) + 1;

  const assign = (cardId: string, placement: CardPlacement) => {
    if (solved) return;
    setResult(null);
    setMessage("");
    setPlacements((current) => ({ ...current, [cardId]: placement }));
    if (placement !== "reject") {
      setReasons((current) => {
        const next = { ...current };
        delete next[cardId];
        return next;
      });
      setActiveCard(null);
    } else {
      setActiveCard(cardId);
    }
  };

  const reset = () => {
    setPlacements({});
    setReasons({});
    setResult(null);
    setTimelineResult(null);
    setTimelineOrder([]);
    setMessage("");
    setActiveCard(null);
  };

  const submitTimeline = async () => {
    if (!code || busy || !timelineReady) return;
    if (missingReasons.length > 0) {
      setError("标记为「" + rejectLabel + "」的卡片需要写一句剔除理由（至少 4 个字）。");
      return;
    }
    setBusy(true); setError("");
    try {
      const response = await api.post<TimelineResult>("/archives/cases/" + code + "/check", {
        order: timelineOrder, rejected: rejectedIds, reasons,
      });
      setTimelineResult(response.data);
      const refreshed = (await api.get<ArchiveCase>("/archives/cases/" + code)).data;
      setCaseData(refreshed);
      if (response.data.passed) {
        const latest = (await api.post<ArchiveProgress>("/archives/cases/" + code + "/start")).data;
        setProgress(latest);
        setMessage("时间轴已经排好，往下完成主线归位与通关追问。");
      }
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };

  const submitThreadMap = async () => {
    if (!code || !caseData?.thread_map || busy) return;
    if (caseData.thread_map.cards.some((card) => !threadMap[card.id])) {
      setError("请为每一张卡片选择所属主线。");
      return;
    }
    setBusy(true); setError("");
    try {
      const response = await api.post<ThreadMapResult>("/archives/cases/" + code + "/thread-map", { mapping: threadMap });
      setThreadMapResult(response.data);
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };

  const check = async () => {
    if (!code || busy || !readyToCheck) return;
    if (missingReasons.length > 0) {
      setError("标记为「" + rejectLabel + "」的卡片需要写一句剔除理由（至少 4 个字）。");
      return;
    }
    setBusy(true); setError("");
    try {
      const response = await api.post<CheckResult>("/archives/cases/" + code + "/check", { placements, reasons });
      setResult(response.data);
      const refreshed = (await api.get<ArchiveCase>("/archives/cases/" + code)).data;
      setCaseData(refreshed);
      if (response.data.passed) {
        const latest = (await api.post<ArchiveProgress>("/archives/cases/" + code + "/start")).data;
        setProgress(latest);
        setMessage("线索已经全部归位，往下完成通关追问与迁移任务。");
      }
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };

  const requestHint = async () => {
    if (!code || busy || solved) return;
    setBusy(true); setError("");
    try {
      const response = await api.post<HintResult>("/archives/cases/" + code + "/hint");
      setHint(response.data);
      const latest = (await api.post<ArchiveProgress>("/archives/cases/" + code + "/start")).data;
      setProgress(latest);
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };

  const submitProbes = async () => {
    if (!code || !caseData?.probes || busy) return;
    setBusy(true); setError("");
    try {
      const answers = caseData.probes.map((probe) => ({ question: probe.question, answer: (probeAnswers[probe.question] ?? "").trim() }));
      const response = await api.post<ProbeResponse>("/archives/cases/" + code + "/probe", { answers });
      setProbeResponse(response.data);
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };

  const submitTransfer = async () => {
    if (!code || !transferOption || transferReason.trim().length < 4 || busy) return;
    setBusy(true); setError("");
    try {
      const response = await api.post<TransferResult>("/archives/cases/" + code + "/transfer", {
        option: transferOption, reason: transferReason.trim(),
      });
      setTransferResponse(response.data);
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };

  const submitChain = async () => {
    if (!code || !caseData?.chain_edges?.length || busy) return;
    if (caseData.chain_edges.some((edge) => !chainLinks[edge.child_id])) {
      setError("请为每一张卡片选择它由哪一张更早的卡片推动。");
      return;
    }
    setBusy(true); setError("");
    try {
      const response = await api.post<ChainResult>("/archives/cases/" + code + "/chain", { links: chainLinks });
      setChainResult(response.data);
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };

  const submitFill = async () => {
    if (!code || fillAnswer.trim().length < 6 || busy) return;
    setBusy(true); setError("");
    try {
      const response = await api.post<FillResult>("/archives/cases/" + code + "/fill", { answer: fillAnswer.trim() });
      setFillResult(response.data);
      const refreshed = (await api.get<ArchiveCase>("/archives/cases/" + code)).data;
      setCaseData(refreshed);
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };

  const complete = async () => {
    if (!code || note.trim().length < 12 || busy) return;
    setBusy(true); setError("");
    try {
      const response = await api.post<ArchiveProgress>("/archives/cases/" + code + "/complete", { reflection: note.trim() });
      setProgress(response.data);
      setMessage("你的发现已写入探索手册。");
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };

  if (loading && !caseData) return <div className="py-24 text-center text-sm text-[#8a8072]">正在打开历史档案…</div>;
  if (!caseData) return <div className="archive-panel py-16 text-center"><CircleAlert className="mx-auto text-[#ae5a43]" /><p className="mt-3 text-sm text-[#80766a]">{error || "档案未找到"}</p><button className="archive-button mt-5" onClick={() => void load()}>重新加载</button><Link className="ml-3 text-sm text-[#a6543e]" to="/archives">返回目录</Link></div>;

  const probePassed = Boolean(probeResponse?.probe_passed) || Boolean(progress?.probe_passed);
  const grouped = (stage: CardPlacement) => cards.filter((card) => placements[card.id] === stage);

  const renderCard = (card: ArchiveCard) => {
    const placement = placements[card.id];
    const inTimeline = timelineOrder.includes(card.id);
    const active = activeCard === card.id && !solved;
    const statusLabel = timelineMode
      ? inTimeline
        ? "时间轴 第 " + timelineIndex(card.id) + " 位"
        : placement === "reject"
          ? rejectLabel
          : "未处理"
      : placement
        ? cardStatusLabel(placement)
        : "未归类";
    return (
      <article key={card.id} className={"archive-clue flex flex-col text-left " + (placement || inTimeline ? "archive-clue-selected" : "")}>
        <button type="button" className="flex-1 text-left" onClick={() => setActiveCard(active ? null : card.id)} disabled={solved}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] tracking-[.15em] text-[#aa624b]">{card.label}</span>
            <span className={"archive-card-status " + (placement || inTimeline ? "is-set" : "")}>{statusLabel}</span>
          </div>
          <p className="mt-3 text-sm leading-7 text-[#655e54]">{card.text}</p>
          <div className="mt-3 border-t border-[#dfd2bf] pt-3 text-[11px] leading-5 text-[#81715f]">出处：{card.source}</div>
        </button>
        {solved && timelineMode && (card.year || card.variant) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#e6dcc9] pt-3 text-[10px]">
            {card.year && <span className="archive-tag is-context">{card.year}</span>}
            {card.variant && <span className="archive-tag is-reject">干扰卡</span>}
            {card.thread && <span className="archive-tag is-thread">主线 {card.thread} · {threadMeta[card.thread]}</span>}
            {card.reject_reason && <span className="text-[#9a5b45]">应当剔除：{card.reject_reason}</span>}
          </div>
        )}
        {solved && !timelineMode && card.stage && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#e6dcc9] pt-3 text-[10px]">
            <span className={"archive-tag " + (card.stage === "distractor" ? "is-reject" : "is-" + card.stage)}>
              {card.stage === "distractor" ? "干扰卡" : stageMeta[card.stage as "context" | "practice" | "theory"].label}
            </span>
            {card.thread && <span className="archive-tag is-thread">主线 {card.thread} · {threadMeta[card.thread]}</span>}
            {card.reject_reason && <span className="text-[#9a5b45]">应当剔除：{card.reject_reason}</span>}
          </div>
        )}
        {active && (
          <div className="archive-chooser mt-3 border-t border-[#e6dcc9] pt-3">
            <div className="text-[11px] text-[#8b8070]">{timelineMode ? "把这张卡放在哪里？" : "把它归入哪一类？"}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {timelineMode ? (
                <>
                  <button type="button" className="archive-chooser-option is-practice" onClick={() => placeOnTimeline(card.id)}>
                    放入时间轴
                  </button>
                  <button type="button" className="archive-chooser-option is-reject" onClick={() => rejectCard(card.id)}>
                    {rejectLabel}
                  </button>
                </>
              ) : (
                options.map((option) => (
                  <button key={option.key} type="button" className={"archive-chooser-option " + option.tone} onClick={() => assign(card.id, option.key)}>
                    {option.label}
                  </button>
                ))
              )}
            </div>
            {placement === "reject" && (
              <div className="mt-3">
                <label className="text-[11px] text-[#8b8070]" htmlFor={"reason-" + card.id}>剔除理由（必填，至少 4 个字）</label>
                <textarea
                  id={"reason-" + card.id}
                  className="archive-input mt-1 min-h-16 resize-y"
                  maxLength={200}
                  value={reasons[card.id] ?? ""}
                  onChange={(event) => setReasons((current) => ({ ...current, [card.id]: event.target.value }))}
                  placeholder="例如：它讲的是另一个年代的事情……"
                />
              </div>
            )}
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="archive-page archive-dossier-page space-y-5">
      <Link to="/archives" className="inline-flex items-center gap-1 text-xs font-medium text-[#7f766a] hover:text-[#a5523c]"><ArrowLeft size={15} /> 返回档案目录</Link>
      <header className={"archive-cover archive-case-header relative overflow-hidden rounded-[14px] px-5 py-6 text-white sm:px-7 sm:py-7 " + (coverClass[caseData.cover] ?? "")}>
        <ArchiveArtwork kind={caseData.cover} className="archive-header-art" />
        <div className="relative z-10 max-w-3xl">
          <div className="flex flex-wrap items-center gap-3 text-[11px] tracking-[.14em] text-white/80"><span className="archive-cover-label">历史档案</span><span>{caseData.era}</span><span>·</span><span>{caseData.chapter}</span></div>
          <h1 className="mt-4 font-serif text-[27px] font-semibold leading-[1.45] sm:text-[34px]">{caseData.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80">{caseData.subtitle}</p>
          <div className="mt-4 inline-flex max-w-2xl items-start gap-2 text-sm leading-7 text-white/90"><Compass size={17} className="mt-1 shrink-0" /><span>本次任务：{caseData.mission}</span></div>
        </div>
        <span className="archive-case-header-seal" aria-hidden="true">寻路<br />档案</span>
      </header>

      {error && <div role="alert" className="archive-error"><CircleAlert size={17} /> {error}</div>}

      <nav aria-label="本关探索步骤" className="archive-steps">
        {[["01", "阅读档案", true], ["02", "整理线索", solved], ["03", "写下发现", completed]].map(([number, label, done]) => (
          <a key={String(number)} href={number === "01" ? "#evidence" : number === "02" ? "#clue-board" : solved ? "#discovery" : "#clue-board"} className={"archive-step " + (done ? "is-done" : "")}>
            <span className="archive-step-number">{done ? <Check size={15} /> : number}</span><span className="text-xs font-semibold">{label}</span>
          </a>
        ))}
      </nav>

      <a href="#archive-agent" className="archive-panel flex items-center justify-between gap-3 p-4 text-sm font-medium text-[#33503c] xl:hidden">需要下一条线索？打开档案探究 Agent <ArrowRight size={16} className="shrink-0" /></a>

      <section className="archive-dossier-workspace grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,.75fr)]">
        <div className="min-w-0 space-y-6">
          <div id="evidence" className="archive-scroll-target">
            <div className="archive-eyebrow">01 / READ &amp; SORT THE EVIDENCE</div>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-[#273a31]">翻阅 {cards.length} 张档案卡</h2>
            <p className="mt-2 text-sm leading-6 text-[#857a6d]">
              {solved
                ? "线索已整理完成。展开卡片可以回看每张卡的归类依据与主线线索。"
                : "逐张阅读材料与出处，点击卡片后为它选择归类；本关混入了 2 张似是而非的干扰卡，需要识别并剔除。"}
            </p>
          </div>
          <div className="archive-deck-grid">{cards.map(renderCard)}</div>

          {!timelineMode && (
          <div id="clue-board" className="archive-panel archive-clue-board archive-scroll-target p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2"><div className="archive-eyebrow">02 / CONNECT THE CLUES</div><span className="archive-selection-count">{assigned.size} / {cards.length} 已归类</span></div>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-[#293c32]">把线索连成一条线</h2>
            <p className="mt-2 text-sm leading-6 text-[#8a8072]">按“历史条件 → 实践探索 → 理论形成”的顺序检查每一类的内容，被识别出的干扰卡放进单独的托盘。</p>

            <div className="archive-stage-grid mt-5">
              {stageOrder.map((stage) => (
                <div key={stage} className="archive-stage-column">
                  <div className="archive-stage-head"><span>{stageMeta[stage].label}</span><span>{grouped(stage).length}</span></div>
                  <p className="mt-1 text-[10px] text-[#a2968a]">{stageMeta[stage].hint}</p>
                  <div className="mt-3 space-y-2">
                    {grouped(stage).map((card) => (
                      <div key={card.id} className="archive-stage-chip">
                        <span className="min-w-0 flex-1 break-words">{card.label}</span>
                        {!solved && <button type="button" aria-label={"移出 " + card.label} onClick={() => setPlacements((current) => { const next = { ...current }; delete next[card.id]; return next; })}>✕</button>}
                      </div>
                    ))}
                    {grouped(stage).length === 0 && <div className="text-[11px] text-[#b0a496]">暂无卡片</div>}
                  </div>
                </div>
              ))}
            </div>

            <div className="archive-reject-tray mt-4">
              <div className="archive-stage-head"><span>{rejectLabel}（干扰卡托盘）</span><span>{grouped("reject").length}</span></div>
              <div className="mt-3 space-y-2">
                {grouped("reject").map((card) => (
                  <div key={card.id} className="archive-stage-chip is-reject">
                    <span className="min-w-0 flex-1 break-words">{card.label}：{solved ? card.reject_reason ?? reasons[card.id] : reasons[card.id] || "等待填写剔除理由"}</span>
                    {!solved && <button type="button" aria-label={"移出 " + card.label} onClick={() => setPlacements((current) => { const next = { ...current }; delete next[card.id]; return next; })}>✕</button>}
                  </div>
                ))}
                {grouped("reject").length === 0 && <div className="text-[11px] text-[#b0a496]">把不符合本关的卡片放进来，并写明理由</div>}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {!solved ? (
                <>
                  <button type="button" className="archive-button" disabled={busy || !readyToCheck} onClick={check}>核对线索 <ArrowRight size={16} /></button>
                  <button type="button" className="archive-button archive-button-ghost" disabled={busy || solved} onClick={requestHint}><Lightbulb size={15} /> 请求提示（剩 {(caseData.hint_total ?? 0) - (progress?.hints_used ?? 0)} 次）</button>
                  {assigned.size > 0 && <button type="button" className="inline-flex items-center gap-1 text-xs text-[#8e8373]" onClick={reset}><RotateCcw size={13} /> 重新整理</button>}
                </>
              ) : (
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#5a7c56]"><CheckCircle2 size={18} /> 线索已全部归位（得分 {(progress?.best_score ?? 1) * 100}%）</span>
              )}
              {message && <span role="status" className="text-xs text-[#5b7656]">{message}</span>}
            </div>

            {hint && <div className="archive-hint mt-4"><Lightbulb size={15} className="mt-0.5 shrink-0" /><div><div className="font-semibold">提示 {hint.exhausted ? "（已用完，以下为最后一条）" : ""}</div><p className="mt-1">{hint.hint}</p></div></div>}

            {result && (
              <div className={"archive-feedback mt-4 " + (result.passed ? "is-pass" : "is-fail")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">核对结果：{result.passed ? "通过" : "未通过"}</span>
                  <span>得分 {result.earned} / {result.total}（{Math.round(result.score * 100)}%）· 第 {result.attempts} 次提交</span>
                </div>
                <div className="mt-2 text-xs leading-6">
                  归类正确 {result.stage_correct} / {result.stage_total}　·　干扰卡剔除 {result.triage_correct} / {result.triage_total}
                </div>
                {result.mistakes.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs leading-6">
                    {result.mistakes.map((mistake) => (
                      <li key={mistake.id}>· {mistake.label}：{mistake.kind === "triage" ? "这张卡可能需要剔除，或是理由还不充分" : "归类可能不对，再比较它在时间线上的位置"}</li>
                    ))}
                  </ul>
                )}
                {!result.passed && <p className="mt-2 text-xs leading-6 text-[#8a6a56]">下一步提示：{result.hint}</p>}
              </div>
            )}
          </div>
          )}

          {timelineMode && (
            <div id="clue-board" className="archive-panel archive-clue-board archive-scroll-target p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2"><div className="archive-eyebrow">02 / BUILD THE TIMELINE</div><span className="archive-selection-count">{handledCount} / {cards.length} 已处理</span></div>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-[#293c32]">把节点排成一条时间轴</h2>
              <p className="mt-2 text-sm leading-6 text-[#8a8072]">按年代先后把卡片放进时间轴；认出年代与内容互相矛盾的卡片，放进剔除托盘并写明理由。</p>

              <div className="mt-5 space-y-2">
                {timelineOrder.map((cardId, index) => {
                  const card = cards.find((item) => item.id === cardId);
                  return (
                    <div key={cardId} className="archive-stage-chip">
                      <span className="w-7 shrink-0 font-serif text-[#b45f45]">{String(index + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1 break-words">{card?.label}</span>
                      {!solved && <button type="button" aria-label={"移出时间轴 " + (card?.label ?? "")} onClick={() => removeFromTimeline(cardId)}>✕</button>}
                    </div>
                  );
                })}
                {timelineOrder.length === 0 && <div className="text-[11px] text-[#b0a496]">还没有节点进入时间轴</div>}
              </div>

              <div className="archive-reject-tray mt-4">
                <div className="archive-stage-head"><span>{rejectLabel}（干扰卡托盘）</span><span>{grouped("reject").length}</span></div>
                <div className="mt-3 space-y-2">
                  {grouped("reject").map((card) => (
                    <div key={card.id} className="archive-stage-chip is-reject">
                      <span className="min-w-0 flex-1 break-words">{card.label}：{solved ? card.reject_reason ?? reasons[card.id] : reasons[card.id] || "等待填写剔除理由"}</span>
                      {!solved && <button type="button" aria-label={"移出 " + card.label} onClick={() => setPlacements((current) => { const next = { ...current }; delete next[card.id]; return next; })}>✕</button>}
                    </div>
                  ))}
                  {grouped("reject").length === 0 && <div className="text-[11px] text-[#b0a496]">把不符合时间轴的卡片放进来，并写明理由</div>}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {!solved ? (
                  <>
                    <button type="button" className="archive-button" disabled={busy || !timelineReady} onClick={submitTimeline}>核对时间轴 <ArrowRight size={16} /></button>
                    <button type="button" className="archive-button archive-button-ghost" disabled={busy || solved} onClick={requestHint}><Lightbulb size={15} /> 请求提示（剩 {(caseData.hint_total ?? 0) - (progress?.hints_used ?? 0)} 次）</button>
                    {handledCount > 0 && <button type="button" className="inline-flex items-center gap-1 text-xs text-[#8e8373]" onClick={reset}><RotateCcw size={13} /> 重新整理</button>}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#5a7c56]"><CheckCircle2 size={18} /> 时间轴已排好（得分 {(progress?.best_score ?? 1) * 100}%）</span>
                )}
                {message && <span role="status" className="text-xs text-[#5b7656]">{message}</span>}
              </div>

              {hint && <div className="archive-hint mt-4"><Lightbulb size={15} className="mt-0.5 shrink-0" /><div><div className="font-semibold">提示 {hint.exhausted ? "（已用完，以下为最后一条）" : ""}</div><p className="mt-1">{hint.hint}</p></div></div>}

              {timelineResult && (
                <div className={"archive-feedback mt-4 " + (timelineResult.passed ? "is-pass" : "is-fail")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">核对结果：{timelineResult.passed ? "通过" : "未通过"}</span>
                    <span>得分 {timelineResult.earned} / {timelineResult.total}（{Math.round(timelineResult.score * 100)}%）· 第 {timelineResult.attempts} 次提交</span>
                  </div>
                  <div className="mt-2 text-xs leading-6">
                    位置正确 {timelineResult.position_hits} / {timelineResult.position_total}　·　干扰卡剔除 {timelineResult.triage_correct} / {timelineResult.triage_total}
                  </div>
                  {timelineResult.mistakes.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs leading-6">
                      {timelineResult.mistakes.map((mistake) => (
                        <li key={mistake.id}>· {mistake.label}：{mistake.kind === "triage" ? "这张卡可能需要剔除" : "它在时间轴上的位置可能不对，再比较年代线索"}</li>
                      ))}
                    </ul>
                  )}
                  {!timelineResult.passed && <p className="mt-2 text-xs leading-6 text-[#8a6a56]">下一步提示：{timelineResult.hint}</p>}
                </div>
              )}
            </div>
          )}

          {solved && (
            <div id="discovery" className="space-y-6 archive-scroll-target">
              <div className="archive-theory-panel p-5 sm:p-7">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-[.15em] text-[#9a5339]"><Sparkles size={16} /> 03 / THEORY UNLOCKED</div>
                <h2 className="mt-4 font-serif text-[27px] font-semibold text-[#2c3e32]">理论形成卡 · {caseData.theory_name}</h2>
                <p className="mt-4 text-sm leading-8 text-[#655e50]">{caseData.theory_summary}</p>
                <div className="mt-5 flex items-start gap-2 border-t border-[#ddcbb2] pt-5 text-xs leading-6 text-[#877763]"><BookOpenText size={16} className="mt-1 shrink-0" /> 根据《毛泽东思想和中国特色社会主义理论体系概论》（2023 年版）对应章节整理。档案卡为教学摘要，请结合教材原文核对。</div>
              </div>

              {(caseData.thread_map?.cards?.length ?? 0) > 0 && (
                <div className="archive-panel p-5 sm:p-6">
                  <div className="archive-eyebrow">04 / THREAD MAP</div>
                  <h2 className="mt-2 font-serif text-2xl font-semibold text-[#293c32]">主线归位：每张卡片属于哪条线？</h2>
                  <p className="mt-2 text-sm leading-6 text-[#8a8072]">把卡片放回四条思想主线：A 实事求是／B 群众路线／C 独立自主／D 矛盾分析。</p>
                  <div className="mt-5 space-y-3">
                    {(caseData.thread_map?.cards ?? []).map((card) => {
                      const graded = threadMapResult?.results.find((item) => item.card_id === card.id);
                      return (
                        <div key={card.id} className="flex flex-wrap items-center gap-2">
                          <span className="archive-stage-chip">{card.label}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {(caseData.thread_map?.options ?? []).map((option) => (
                              <button
                                key={option.key}
                                type="button"
                                aria-label={card.label + " 主线 " + option.key}
                                className={"archive-chooser-option " + (threadMap[card.id] === option.key ? "is-theory" : "")}
                                onClick={() => setThreadMap((current) => ({ ...current, [card.id]: option.key }))}
                                disabled={Boolean(threadMapResult?.passed)}
                              >
                                {option.key} {option.name}
                              </button>
                            ))}
                          </div>
                          {graded && (
                            <span className={"archive-tag " + (graded.correct ? "is-theory" : "is-reject")}>
                              {graded.correct ? "正确" : "应为 " + graded.answer}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button type="button" className="archive-button" disabled={busy || Boolean(threadMapResult?.passed)} onClick={submitThreadMap}>
                      {threadMapResult?.passed ? "主线归位已完成" : "提交主线归位"} <ArrowRight size={16} />
                    </button>
                    {threadMapResult && (
                      <span className={"text-xs " + (threadMapResult.passed ? "text-[#5a7c56]" : "text-[#a26450]")}>
                        正确 {threadMapResult.correct_count} / {threadMapResult.total}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {(caseData.chain_edges ?? []).length > 0 && (
                <div className="archive-panel p-5 sm:p-6">
                  <div className="archive-eyebrow">04 / CAUSAL LINKS</div>
                  <h2 className="mt-2 font-serif text-2xl font-semibold text-[#293c32]">因果连线：认识从哪里来？</h2>
                  <p className="mt-2 text-sm leading-6 text-[#8a8072]">实践源于当时的条件，认识又来自实践。为下面每张卡片选择它由哪一张更早的卡片推动。</p>
                  <div className="mt-5 space-y-3">
                    {(caseData.chain_edges ?? []).map((edge) => {
                      const graded = chainResult?.results.find((item) => item.child_id === edge.child_id);
                      return (
                        <div key={edge.child_id} className="flex flex-wrap items-center gap-2">
                          <span className="archive-stage-chip">{edge.child_label}</span>
                          <span className="text-xs text-[#a2968a]">由</span>
                          <div className="min-w-[200px] flex-1">
                            <select
                              aria-label={edge.child_label + " 的来源"}
                              className="archive-input"
                              value={chainLinks[edge.child_id] ?? ""}
                              onChange={(event) => setChainLinks((current) => ({ ...current, [edge.child_id]: event.target.value }))}
                              disabled={Boolean(chainResult?.passed)}
                            >
                              <option value="">请选择推动它的卡片</option>
                              {edge.options.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                          <span className="text-xs text-[#a2968a]">推动</span>
                          {graded && (
                            <span className={"archive-tag " + (graded.correct ? "is-theory" : "is-reject")}>
                              {graded.correct ? "正确" : "应为：" + graded.accepted.map((item) => item.label).join(" / ")}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button type="button" className="archive-button" disabled={busy || chainResult?.passed} onClick={submitChain}>
                      {chainResult?.passed ? "因果连线已完成" : "提交连线"} <ArrowRight size={16} />
                    </button>
                    {chainResult && (
                      <span className={"text-xs " + (chainResult.passed ? "text-[#5a7c56]" : "text-[#a26450]")}>
                        正确 {chainResult.correct_count} / {chainResult.total}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {caseData.fill_blank && (
                <div className="archive-panel p-5 sm:p-6">
                  <div className="archive-eyebrow">05 / MISSING CARD</div>
                  <h2 className="mt-2 font-serif text-2xl font-semibold text-[#293c32]">缺失补全：把抽走的卡片写回来</h2>
                  <p className="mt-2 text-sm leading-6 text-[#8a8072]">
                    本关有一张卡片在整理时被抽出（<span className="font-semibold text-[#7c6a52]">{caseData.fill_blank.label}</span>）。请用自己的话把它写回来，至少覆盖时间、做法与结果三个要点。
                  </p>
                  <textarea
                    aria-label="缺失卡补全"
                    className="archive-input mt-3 min-h-24 resize-y"
                    maxLength={600}
                    value={fillAnswer}
                    onChange={(event) => setFillAnswer(event.target.value)}
                    placeholder="例如：1930年，针对……提出……，推动……"
                    disabled={Boolean(fillResult?.correct)}
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button type="button" className="archive-button" disabled={busy || Boolean(fillResult?.correct)} onClick={submitFill}>
                      {fillResult?.correct ? "补全已完成" : "提交补全"} <ArrowRight size={16} />
                    </button>
                    {fillResult && (
                      <span className={"text-xs leading-6 " + (fillResult.correct ? "text-[#5a7c56]" : "text-[#a26450]")}>
                        {fillResult.correct
                          ? "三个要点基本覆盖。"
                          : "还缺要点：" + fillResult.points.filter((point) => !fillResult.hit.includes(point)).join("、")}
                      </span>
                    )}
                  </div>
                  {fillResult && (
                    <div className="mt-4 rounded-xl border border-[#e0d7c9] bg-[#fffcf5] p-4 text-xs leading-6 text-[#6b6154]">
                      <div className="font-semibold text-[#33473a]">原卡（{fillResult.card.label}）</div>
                      <p className="mt-1">{fillResult.card.text}</p>
                      <p className="mt-1 text-[#9b7055]">出处：{fillResult.card.source}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="archive-panel p-5 sm:p-6">
                <div className="archive-eyebrow">POST-PASS / PROBE &amp; TRANSFER</div>
                <h2 className="mt-2 font-serif text-2xl font-semibold text-[#293c32]">通关追问与迁移任务</h2>
                <p className="mt-2 text-sm leading-6 text-[#8a8072]">归位正确不等于真的理解。用你自己的话回答两个追问，再把本关的方法用到当代情境里。</p>

                <div className="mt-5 space-y-4">
                  {(caseData.probes ?? []).map((probe, index) => {
                    const graded = probeResponse?.results.find((item) => item.question === probe.question);
                    return (
                      <div key={probe.question} className="rounded-xl border border-[#e0d7c9] bg-[#fffcf5] p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-semibold text-[#33473a]">追问 {index + 1}：{probe.question}</div>
                          {graded && <span className={"archive-tag " + (graded.correct ? "is-theory" : "is-reject")}>{graded.correct ? "已通过" : "待完善"}</span>}
                        </div>
                        <textarea
                          id={"probe-" + index}
                          aria-label={"追问 " + (index + 1) + " 回答"}
                          className="archive-input mt-3 min-h-20 resize-y"
                          maxLength={600}
                          value={probeAnswers[probe.question] ?? ""}
                          onChange={(event) => setProbeAnswers((current) => ({ ...current, [probe.question]: event.target.value }))}
                          placeholder="用自己的话回答，不必照抄材料……"
                        />
                        {graded && !graded.correct && <p className="mt-2 text-xs leading-6 text-[#8a6a56]">参考要点：{graded.reference}</p>}
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" className="archive-button" disabled={busy || probePassed || !caseData.probes?.length} onClick={submitProbes}>
                      {probePassed ? "追问已通过" : "提交追问"} <ArrowRight size={16} />
                    </button>
                    {probeResponse && !probePassed && <span className="text-xs text-[#a26450]">{probeResponse.answered_all ? "有要点还没答到，参考要点后再补充一次。" : "两道追问都要作答。"}</span>}
                  </div>
                </div>

                {caseData.transfer && (
                  <div className="mt-6 border-t border-[#e6dcc9] pt-5">
                    <div className="text-sm font-semibold text-[#33473a]">迁移任务：{caseData.transfer.scenario}</div>
                    <div className="mt-3 space-y-2">
                      {caseData.transfer.options.map((option) => (
                        <label key={option.key} className={"archive-transfer-option " + (transferOption === option.key ? "is-active" : "") + (transferResponse && caseData.transfer?.answer === option.key ? " is-answer" : "")}>
                          <input
                            type="radio"
                            name="transfer"
                            className="mt-1"
                            checked={transferOption === option.key}
                            onChange={() => setTransferOption(option.key)}
                            disabled={Boolean(transferResponse?.correct)}
                          />
                          <span>{option.key}. {option.text}</span>
                        </label>
                      ))}
                    </div>
                    <textarea
                      aria-label="迁移理由"
                      className="archive-input mt-3 min-h-16 resize-y"
                      maxLength={400}
                      value={transferReason}
                      onChange={(event) => setTransferReason(event.target.value)}
                      placeholder="说明你选择的理由（至少 4 个字）……"
                      disabled={Boolean(transferResponse?.correct)}
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button type="button" className="archive-button" disabled={busy || !transferOption || transferReason.trim().length < 4 || Boolean(transferResponse?.correct)} onClick={submitTransfer}>
                        {transferResponse?.correct ? "迁移任务已完成" : "提交迁移选择"} <ArrowRight size={16} />
                      </button>
                      {transferResponse && (
                        <span className={"text-xs leading-6 " + (transferResponse.correct ? "text-[#5a7c56]" : "text-[#a26450]")}>
                          {transferResponse.correct ? "判断正确。" : "再想一想：这里的关键是兼顾，而不是走极端。"}参考：{transferResponse.rationale}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="archive-panel p-5 sm:p-7">
                <div className="archive-eyebrow">POST-PASS / WRITE YOUR DISCOVERY</div>
                <label className="mt-2 block font-serif text-xl font-semibold text-[#334639]" htmlFor="reflection">写下你的发现</label>
                <p className="mt-2 text-sm leading-6 text-[#786e60]">{caseData.reflection_prompt}</p>
                <textarea id="reflection" className="archive-input mt-3 min-h-[130px] resize-y" maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="结合档案中的一个具体线索，用自己的话解释……" />
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" className="archive-button" disabled={busy || note.trim().length < 12} onClick={complete}>{completed ? "更新发现笔记" : "保存发现笔记"} <ArrowRight size={16} /></button>
                  <span className="text-xs text-[#988b78]">{note.trim().length} / 至少 12 字</span>
                  {completed && <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#5d7e5a]"><CheckCircle2 size={15} /> 已收入我的发现</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-5 self-start xl:sticky xl:top-[92px]">
          {code && <ArchiveAgentPanel key={code} code={code} cards={cards} />}
          <div className="archive-panel p-5">
            <div className="archive-eyebrow">EXPLORER'S NOTE</div>
            <h2 className="mt-2 font-serif text-lg font-semibold text-[#2e4034]">阅读方法</h2>
            <ol className="mt-4 space-y-3 text-xs leading-6 text-[#7d7264]">
              <li><span className="mr-2 font-serif text-[#b45f45]">01</span> 注意每张卡的材料出处与年代。</li>
              <li><span className="mr-2 font-serif text-[#b45f45]">02</span> 区分“遇到的问题”“采取的行动”与“形成的认识”。</li>
              <li><span className="mr-2 font-serif text-[#b45f45]">03</span> 似是而非的干扰卡要用年代、因果或概念判据把它排除。</li>
            </ol>
          </div>
          {completed && <Link to="/journal" className="archive-button w-full">查看我的发现 <ArrowRight size={16} /></Link>}
        </aside>
      </section>
    </div>
  );
}
