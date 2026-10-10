import { useEffect, useState } from "react";
import { ArrowRight, BookOpenText, Bot, CircleAlert, Compass, RotateCw, Send, Sparkles } from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import type { ArchiveCard } from "../lib/archive";

interface AgentEvidence {
  id: string;
  label: string;
  text: string;
  source: string;
  kind: "archive" | "knowledge";
}

interface AgentTurn {
  id: number;
  question: string;
  answer: string;
  stage: "explore" | "connect" | "reflect";
  focus_clue_id: string | null;
  evidence: AgentEvidence[];
  tools: string[];
  mode: "offline" | "online";
  created_at: string;
}

const stageName = { explore: "查找线索", connect: "串联理论", reflect: "回看发现" };

export default function ArchiveAgentPanel({ code, cards }: { code: string; cards: ArchiveCard[] }) {
  const [question, setQuestion] = useState("");
  const [focus, setFocus] = useState("");
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get<AgentTurn[]>(`/archives/cases/${code}/agent/history`)
      .then(({ data }) => { if (active) setTurns(data); })
      .catch((reason) => { if (active) setError(apiErrorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [code]);

  const investigate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await api.post<AgentTurn>(`/archives/cases/${code}/agent`, {
        question: question.trim(), focus_clue_id: focus || null,
      });
      setTurns((current) => [...current, response.data].slice(-8));
      setQuestion("");
    } catch (reason) {
      setError(apiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const latest = turns[turns.length - 1];
  return <section id="archive-agent" className="archive-agent overflow-hidden" aria-labelledby="archive-agent-title">
    <div className="archive-agent-head p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[10px] font-semibold tracking-[.13em] text-[#e5ceb0]"><Bot size={17} /> 档案探究 AGENT</span>
        <span className="rounded-full border border-white/25 px-2.5 py-1 text-[10px] text-[#d8e6d4]">{loading ? "读取记录…" : `${turns.length} 次探究`}</span>
      </div>
      <h2 id="archive-agent-title" className="mt-4 font-serif text-[23px] font-semibold text-[#fff8e9]">下一步，从哪条线索查起？</h2>
      <p className="mt-2 text-xs leading-6 text-[#d5dfd3]">Agent 会看你当前的探索阶段，选择档案或理论手册中的证据，再给你一个可继续追问的问题。</p>
      <div className="mt-5 grid grid-cols-3 gap-1.5 text-center text-[10px] text-[#f3e6cb]">
        {["观察进度", "选择资料", "提出下一问"].map((item, index) => <span key={item} className="rounded-lg border border-white/15 bg-white/10 px-1 py-2"><span className="mr-1 text-[#e8b980]">0{index + 1}</span>{item}</span>)}
      </div>
    </div>
    <div className="space-y-4 bg-[#fffdf8] p-5">
      <form className="space-y-3" onSubmit={investigate}>
        <label className="block text-xs font-semibold text-[#384b3d]" htmlFor="agent-question">你想调查什么？<span className="ml-1 font-normal text-[#8b8070]">也可以留空，让 Agent 自动找下一步</span></label>
        <textarea id="agent-question" className="archive-input min-h-20 resize-y" maxLength={300} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：为什么这条实践能回应当时的问题？" />
        <label className="block text-xs font-semibold text-[#384b3d]" htmlFor="agent-focus">指定一张卡 <span className="font-normal text-[#8b8070]">可选</span></label>
        <select id="agent-focus" className="archive-input" value={focus} onChange={(event) => setFocus(event.target.value)}>
          <option value="">由 Agent 选择</option>
          {cards.map((card) => <option key={card.id} value={card.id}>{card.label}</option>)}
        </select>
        <button className="archive-button w-full justify-center" type="submit" disabled={busy || loading}>
          {busy ? <>正在查找资料 <RotateCw size={15} className="animate-spin" /></> : <>获取下一条线索 <Send size={15} /></>}
        </button>
      </form>
      {error && <p role="alert" className="flex items-start gap-2 text-xs leading-6 text-[#a94f3c]"><CircleAlert size={15} className="mt-1 shrink-0" />{error}</p>}
      {latest && <div role="status" className="archive-agent-result space-y-4 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#527154]"><Sparkles size={14} />{stageName[latest.stage]}</span><span className="text-[10px] text-[#988979]">{latest.mode === "online" ? "模型规划" : "离线规划"}</span></div>
        <p className="font-serif text-[17px] leading-7 text-[#314336]">{latest.answer}</p>
        <div className="border-t border-[#ded9c9] pt-3"><div className="mb-2 text-[10px] font-semibold tracking-[.1em] text-[#9b6b50]">本轮查证</div><div className="flex flex-wrap gap-1.5">{latest.tools.map((tool) => <span key={tool} className="rounded-full border border-[#d6cbbb] bg-white/70 px-2 py-1 text-[10px] text-[#756a5c]">{tool}</span>)}</div></div>
        <div className="space-y-2">{latest.evidence.map((item) => <div key={item.id} className="rounded-lg border border-[#e0d7c9] bg-[#fffcf5] p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#374d3e]">{item.kind === "archive" ? <Compass size={13} /> : <BookOpenText size={13} />}{item.label}</div>
          <p className="mt-1.5 text-xs leading-5 text-[#73685b]">{item.text}</p>
          <p className="mt-2 break-words text-[10px] leading-5 text-[#9b7055]">出处：{item.source}</p>
        </div>)}</div>
        {turns.length > 1 && <details className="border-t border-[#ded9c9] pt-3"><summary className="cursor-pointer text-xs text-[#746959]">回看之前的 {turns.length - 1} 次探究</summary><ol className="mt-3 space-y-2 text-xs leading-5 text-[#71685e]">{turns.slice(0, -1).reverse().map((turn) => <li key={turn.id} className="rounded-lg bg-[#f7f0e6] p-3"><span className="block text-[10px] text-[#9b6b50]">{turn.question}</span>{turn.answer}</li>)}</ol></details>}
      </div>}
      {!latest && !loading && !error && <p className="flex items-start gap-2 text-xs leading-6 text-[#8b8071]"><ArrowRight size={14} className="mt-1 shrink-0" />试着提出一个问题，或直接让 Agent 给你下一步。</p>}
    </div>
  </section>;
}
