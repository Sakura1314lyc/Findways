import { MessageCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import ChatWorkspace from "../components/ChatWorkspace";

export default function ChatPage() {
  const [params, setParams] = useSearchParams();
  const caseCode = params.get("case") ?? undefined;
  const requestedId = Number(params.get("session"));
  const sessionId = Number.isSafeInteger(requestedId) && requestedId > 0 ? requestedId : undefined;

  return <div className="archive-page chat-page">
    <header className="chat-page-heading"><div><div className="archive-eyebrow">THE CONVERSATION ROOM / 会客室</div><h1 className="mt-2 font-serif text-[30px] font-semibold text-[#2c4034] sm:text-[38px]">聊天助手</h1><p className="mt-2 text-sm leading-6 text-[#8a7b67]">聊一个问题，也聊一会儿。</p></div><span className="chat-page-seal" aria-hidden="true"><MessageCircle size={31} strokeWidth={1.2} /></span></header>
    <ChatWorkspace key={caseCode ?? "general"} caseCode={caseCode} initialSessionId={sessionId} onSessionChange={(id) => {
      const next = new URLSearchParams(params);
      if (id) next.set("session", String(id));
      else next.delete("session");
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }} />
  </div>;
}
