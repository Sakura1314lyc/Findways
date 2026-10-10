import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, BookOpenText, Bot, Check, ChevronDown, Copy, History, MessageCircle, Plus, RefreshCw, Send, Sparkles, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useChat from "../hooks/useChat";
import { chatDate } from "../lib/chat";

interface Props {
  caseCode?: string;
  caseTitle?: string;
  compact?: boolean;
  initialSessionId?: number;
  onSessionChange?: (id: number | null) => void;
}

export default function ChatWorkspace({ caseCode, caseTitle, compact = false, initialSessionId, onSessionChange }: Props) {
  const chat = useChat(caseCode, initialSessionId);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [copyError, setCopyError] = useState("");
  const [viewport, setViewport] = useState(window.visualViewport?.height ?? window.innerHeight);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastMessage = chat.messages[chat.messages.length - 1]?.id;
  const contextCode = chat.active?.case_code ?? caseCode;
  const fullChatURL = "/chat?" + new URLSearchParams({
    ...(contextCode ? { case: contextCode } : {}), ...(chat.active ? { session: String(chat.active.id) } : {}),
  }).toString();

  useEffect(() => {
    const resize = () => setViewport(window.visualViewport?.height ?? window.innerHeight);
    window.visualViewport?.addEventListener("resize", resize);
    return () => window.visualViewport?.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lastMessage, chat.pending, chat.active?.id]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 140) + "px";
    }
  }, [chat.draft]);

  useEffect(() => {
    if (!chat.loading) onSessionChange?.(chat.active?.id ?? null);
    setConfirmDelete(false);
  }, [chat.active?.id, chat.loading]);

  const choose = async (id: number) => { await chat.select(id); setHistoryOpen(false); };
  const copy = async (id: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(id);
      setCopyError("");
      window.setTimeout(() => setCopied((current) => current === id ? null : current), 1800);
    } catch { setCopyError("暂时无法自动复制，请长按或选中文本复制。"); }
  };
  const suggestions = caseCode ? ["解释一下这关的主题", "帮我安排一份复习计划", "今天有点累，想聊聊"] : [
    "实事求是和解放思想有什么联系？", "怎样安排复习才不会越学越焦虑？", "推荐一种课间放松的小方法",
  ];

  return <div id={compact ? "archive-chat" : undefined} className={"chat-workspace " + (compact ? "is-compact" : "")} style={{ "--chat-viewport": `${viewport}px` } as React.CSSProperties}>
    {!compact && <aside className={"chat-history " + (historyOpen ? "is-open" : "")} aria-label="对话记录">
      <div className="chat-history-heading"><span className="archive-eyebrow">CONVERSATIONS</span><span className="text-[11px] text-[#90816e]">最近 {chat.sessions.length} 个</span></div>
      <button type="button" className="chat-new-button" onClick={chat.startNew} disabled={chat.busy || chat.loading}><Plus size={17} /> 开始新对话</button>
      <div className="chat-history-list">
        {chat.sessions.map((item) => <button type="button" key={item.id} className={"chat-history-item " + (chat.active?.id === item.id ? "is-active" : "")} onClick={() => void choose(item.id)} disabled={chat.busy || chat.loading}>
          <MessageCircle size={15} /><span className="min-w-0 flex-1"><strong className="block truncate text-xs font-medium">{item.title}</strong><small className="mt-1 block text-[10px] opacity-65">{chatDate(item.updated_at)} · {item.case_code ? "档案答疑" : "自由对话"}</small></span>
        </button>)}
        {!chat.sessions.length && <p className="px-2 py-6 text-xs leading-6 text-[#91816d]">从一个问题开始，<br />聊过的内容会留在这里。</p>}
      </div>
      <div className="chat-history-note"><BookOpenText size={19} /><span>可以聊课程，也可以聊生活。<br />记录只在你的账号下可见。</span></div>
    </aside>}

    <section className="chat-conversation" aria-label="寻路聊天助手">
      <header className="chat-header">
        <div className="flex min-w-0 items-center gap-3"><span className="chat-bot-mark"><Bot size={22} strokeWidth={1.5} /></span><div className="min-w-0"><h2 className="font-serif text-lg font-semibold text-[#fff5de]">寻路聊天助手</h2><span className="chat-connection"><i className={chat.status?.available ? "is-ready" : ""} />{chat.loading && !chat.status ? "正在连接" : chat.status?.available ? "可以开始对话" : "模型待连接"}</span></div></div>
        {compact ? <Link to={fullChatURL} className="chat-header-link" aria-label="打开完整聊天">完整聊天 <ArrowUpRight size={15} /></Link> : <button type="button" className="chat-history-toggle" onClick={() => setHistoryOpen((value) => !value)} aria-expanded={historyOpen}><History size={18} />记录</button>}
      </header>

      <div className="chat-toolbar">
        <span className="min-w-0 flex-1 truncate text-[11px] text-[#786a59]">{contextCode ? (caseTitle ?? "当前对话关联了一份档案") : "课程答疑 · 学习咨询 · 日常聊天"}</span>
        {compact && chat.sessions.length > 0 && <label className="chat-session-picker"><span className="sr-only">选择历史对话</span><select value={chat.active?.id ?? ""} onChange={(event) => event.target.value ? void choose(Number(event.target.value)) : chat.startNew()} disabled={chat.busy || chat.loading}><option value="">新对话</option>{chat.sessions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><ChevronDown size={12} /></label>}
        {compact && <button type="button" className="chat-icon-button" aria-label="开始新对话" title="开始新对话" onClick={chat.startNew} disabled={chat.busy || chat.loading}><Plus size={16} /></button>}
        {chat.active && <button type="button" className="chat-icon-button" aria-label="删除当前对话" title="删除当前对话" onClick={() => setConfirmDelete(true)} disabled={chat.busy || chat.loading}><Trash2 size={14} /></button>}
      </div>
      {confirmDelete && <div className="chat-delete-confirm" role="alert">删除这段对话及其消息？<button type="button" onClick={() => { setConfirmDelete(false); void chat.remove(); }}>删除</button><button type="button" onClick={() => setConfirmDelete(false)}>取消</button></div>}

      <div ref={logRef} className="chat-log" role="log" aria-label="聊天消息" aria-live="polite" aria-busy={chat.loading}>
        {chat.loading ? <p className="chat-loading">正在翻开对话记录…</p> : <>
          {chat.hasMore && <button type="button" className="chat-load-older" onClick={() => void chat.loadOlder()} disabled={chat.olderLoading || chat.busy}>{chat.olderLoading ? "正在读取…" : "查看更早的消息"}</button>}
          {!chat.messages.length && !chat.pending && <div className="chat-empty">
            <div className="chat-empty-emblem" aria-hidden="true"><Sparkles size={28} strokeWidth={1.3} /></div>
            <span className="archive-eyebrow">A LITTLE CONVERSATION</span>
            <h3 className="font-serif text-[25px] leading-snug text-[#2d4536]">有个问题，<br />我们一起聊聊。</h3>
            <p className="text-xs leading-6 text-[#8c7c68]">{compact ? "读档案时的疑问，复习时的烦恼，或只是想说说今天。" : "从一个概念、一份计划，或今天的心情开始。不必局限于当前关卡。"}</p>
            <div className="chat-suggestions">{suggestions.map((text) => <button type="button" key={text} onClick={() => { chat.updateDraft(text); inputRef.current?.focus(); }} disabled={chat.busy}>{text}<ArrowUpRight size={13} /></button>)}</div>
          </div>}
          {chat.messages.map((message) => <article key={message.id} className={"chat-message is-" + message.role}>
            <div className="chat-message-label">{message.role === "assistant" ? <><Bot size={13} />寻路</> : "你"}</div>
            <div className="chat-bubble">{message.role === "assistant" ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
              a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
              table: ({ children }) => <div className="chat-table-scroll"><table>{children}</table></div>,
            }}>{message.content}</ReactMarkdown> : message.content}</div>
            {message.role === "assistant" && <button type="button" className="chat-copy" aria-label="复制回复" onClick={() => void copy(message.id, message.content)}>{copied === message.id ? <><Check size={12} />已复制</> : <><Copy size={12} />复制</>}</button>}
          </article>)}
          {chat.pending && <><article className="chat-message is-user"><div className="chat-message-label">你</div><div className="chat-bubble">{chat.pending}</div></article><div className="chat-thinking" role="status"><Bot size={17} /><span>正在回复</span><i /><i /><i /></div></>}
        </>}
      </div>

      <div className="chat-compose-area">
        {chat.error && <div className="chat-error" role="alert"><span>{chat.error}</span><button type="button" onClick={() => void (chat.status ? chat.refreshStatus() : window.location.reload())} aria-label="重新检查聊天连接"><RefreshCw size={15} /></button></div>}
        {copyError && <p className="text-[11px] text-[#9b6146]" role="status">{copyError}</p>}
        {chat.status && !chat.status.available && <div className="chat-offline" role="status"><span>聊天服务尚未开启，管理员连接模型后即可发送。</span><button type="button" onClick={() => void chat.refreshStatus()}>重新检查</button></div>}
        <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); void chat.send(); }}>
          <label className="sr-only" htmlFor={compact ? "archive-chat-input" : "chat-input"}>输入聊天消息</label>
          <textarea ref={inputRef} id={compact ? "archive-chat-input" : "chat-input"} value={chat.draft} onChange={(event) => chat.updateDraft(event.target.value)} maxLength={4000} rows={1} disabled={chat.busy || chat.loading} placeholder="问个问题，或聊聊今天…" onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) { event.preventDefault(); void chat.send(); }
          }} />
          <button type="submit" className="chat-send" disabled={!chat.status?.available || chat.busy || chat.loading || !chat.draft.trim()} aria-label="发送消息"><Send size={18} /></button>
        </form>
        <div className="chat-compose-meta"><span>{chat.busy ? "回复生成后会自动保存" : "回答由 AI 生成，课程内容请结合教材核对"}</span><span className="shrink-0 tabular-nums">{chat.draft.length} / 4000</span></div>
      </div>
    </section>
  </div>;
}
