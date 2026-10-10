import { useEffect, useRef, useState } from "react";
import { api, apiErrorMessage } from "../lib/api";
import type { ChatDetail, ChatMessage, ChatReply, ChatSession, ChatStatus } from "../lib/chat";
import { useAuthStore } from "../stores/auth";

type PendingRequest = { id: string; content: string; sessionId: number };

function requestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function useChat(caseCode?: string, initialSessionId?: number) {
  const userId = useAuthStore((state) => state.user?.id);
  const storageKey = `xunlu-chat:${userId ?? "guest"}:${caseCode ?? "general"}`;
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [active, setActive] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const alive = useRef(true);
  const operation = useRef(0);
  const sending = useRef(false);
  const retry = useRef<PendingRequest | null>(null);

  const rememberRetry = (value: PendingRequest | null) => {
    retry.current = value;
    try {
      if (value) sessionStorage.setItem(storageKey + ":retry", JSON.stringify(value));
      else sessionStorage.removeItem(storageKey + ":retry");
    } catch { return; }
  };

  const remember = (id: number | null) => {
    try {
      if (id === null) sessionStorage.removeItem(storageKey + ":session");
      else sessionStorage.setItem(storageKey + ":session", String(id));
    } catch { return; }
  };

  useEffect(() => {
    alive.current = true;
    const ticket = ++operation.current;
    const boot = async () => {
      try {
        const [state, history] = await Promise.all([
          api.get<ChatStatus>("/chat/status"),
          api.get<ChatSession[]>("/chat/sessions", { params: caseCode ? { case_code: caseCode } : {} }),
        ]);
        if (!alive.current || operation.current !== ticket) return;
        setStatus(state.data);
        setSessions(history.data);
        let remembered: number | undefined;
        try {
          setDraft(sessionStorage.getItem(storageKey + ":draft") ?? "");
          remembered = Number(sessionStorage.getItem(storageKey + ":session")) || undefined;
          const savedRetry = JSON.parse(sessionStorage.getItem(storageKey + ":retry") ?? "null");
          if (savedRetry && typeof savedRetry.id === "string" && typeof savedRetry.content === "string" && typeof savedRetry.sessionId === "number") retry.current = savedRetry;
        } catch { remembered = undefined; }
        const selected = initialSessionId ?? (history.data.some((item) => item.id === remembered) ? remembered : undefined);
        if (selected) {
          const { data } = await api.get<ChatDetail>(`/chat/sessions/${selected}`);
          if (!alive.current || operation.current !== ticket) return;
          setActive(data.session);
          setMessages(data.messages);
          setHasMore(data.has_more);
          remember(data.session.id);
        }
      } catch (reason) {
        if (alive.current && operation.current === ticket) setError(apiErrorMessage(reason));
      } finally {
        if (alive.current && operation.current === ticket) setLoading(false);
      }
    };
    void boot();
    return () => { alive.current = false; operation.current++; };
  }, [caseCode, userId]);

  const updateDraft = (value: string) => {
    setDraft(value);
    try { sessionStorage.setItem(storageKey + ":draft", value); } catch { return; }
  };

  const select = async (id: number) => {
    if (sending.current || loading) return;
    const ticket = ++operation.current;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<ChatDetail>(`/chat/sessions/${id}`);
      if (!alive.current || operation.current !== ticket) return;
      setActive(data.session);
      setMessages(data.messages);
      setHasMore(data.has_more);
      remember(id);
      updateDraft("");
      rememberRetry(null);
    } catch (reason) {
      if (alive.current && operation.current === ticket) setError(apiErrorMessage(reason));
    } finally {
      if (alive.current && operation.current === ticket) setLoading(false);
    }
  };

  const startNew = () => {
    if (sending.current || loading) return;
    operation.current++;
    setActive(null);
    setMessages([]);
    setHasMore(false);
    setError("");
    updateDraft("");
    remember(null);
    rememberRetry(null);
  };

  const refreshStatus = async () => {
    setError("");
    try {
      const { data } = await api.get<ChatStatus>("/chat/status");
      if (alive.current) setStatus(data);
    } catch (reason) {
      if (alive.current) setError(apiErrorMessage(reason));
    }
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || content.length > 4000 || sending.current || loading || !status?.available) return;
    sending.current = true;
    const ticket = ++operation.current;
    setBusy(true);
    setPending(content);
    setError("");
    try {
      let conversation = active;
      if (!conversation) {
        const { data } = await api.post<ChatSession>("/chat/sessions", { case_code: caseCode ?? null });
        conversation = data;
        if (!alive.current || operation.current !== ticket) return;
        setActive(data);
        setSessions((current) => [data, ...current]);
        remember(data.id);
      }
      if (retry.current?.content !== content || retry.current.sessionId !== conversation.id) {
        rememberRetry({ id: requestId(), content, sessionId: conversation.id });
      }
      const { data } = await api.post<ChatReply>(`/chat/sessions/${conversation.id}/messages`, {
        content, request_id: retry.current!.id,
      });
      if (!alive.current || operation.current !== ticket) return;
      setMessages((current) => [...current.filter((item) => !data.messages.some((row) => row.id === item.id)), ...data.messages]);
      setActive(data.session);
      setSessions((current) => [data.session, ...current.filter((item) => item.id !== data.session.id)]);
      updateDraft("");
      rememberRetry(null);
    } catch (reason) {
      if (alive.current && operation.current === ticket) setError(apiErrorMessage(reason));
    } finally {
      sending.current = false;
      if (alive.current && operation.current === ticket) { setBusy(false); setPending(""); }
    }
  };

  const loadOlder = async () => {
    if (!active || !messages[0] || olderLoading || loading || sending.current) return;
    const ticket = operation.current;
    setOlderLoading(true);
    try {
      const { data } = await api.get<ChatDetail>(`/chat/sessions/${active.id}`, { params: { before_id: messages[0].id } });
      if (!alive.current || operation.current !== ticket) return;
      setMessages((current) => [...data.messages, ...current]);
      setHasMore(data.has_more);
    } catch (reason) {
      if (alive.current && operation.current === ticket) setError(apiErrorMessage(reason));
    } finally { if (alive.current) setOlderLoading(false); }
  };

  const remove = async () => {
    if (!active || sending.current || loading) return;
    setLoading(true);
    setError("");
    try {
      await api.delete(`/chat/sessions/${active.id}`);
      if (!alive.current) return;
      setSessions((current) => current.filter((item) => item.id !== active.id));
      setActive(null);
      setMessages([]);
      setHasMore(false);
      remember(null);
      updateDraft("");
      rememberRetry(null);
    } catch (reason) { if (alive.current) setError(apiErrorMessage(reason)); }
    finally { if (alive.current) setLoading(false); }
  };

  return { sessions, active, messages, status, draft, loading, busy, error, pending, hasMore, olderLoading,
    updateDraft, select, startNew, send, refreshStatus, loadOlder, remove };
}
