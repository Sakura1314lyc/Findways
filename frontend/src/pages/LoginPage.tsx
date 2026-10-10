import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Sparkles } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { api, apiErrorMessage } from "../lib/api";
import { useAuthStore } from "../stores/auth";
import type { TokenPair, User } from "../lib/types";

export default function LoginPage() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [account, setAccount] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const accessToken = useAuthStore((state) => state.accessToken);
  const setTokens = useAuthStore((state) => state.setTokens);
  const setUser = useAuthStore((state) => state.setUser);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";

  if (accessToken) return <Navigate to={redirectTo} replace />;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const response = tab === "login"
        ? await api.post<TokenPair>("/auth/login", { account: account.trim(), password })
        : await api.post<TokenPair>("/auth/register", { email: email.trim(), username: username.trim(), password });
      const me = await api.get<User>("/auth/me", {
        headers: { Authorization: "Bearer " + response.data.access_token },
      });
      setTokens(response.data.access_token, response.data.refresh_token);
      setUser(me.data);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (next: "login" | "register") => {
    setTab(next);
    setError("");
    setPassword("");
  };

  return (
    <main className="min-h-screen bg-[#f8f6f1] lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(460px,.92fr)]">
      <section className="archive-login-scene relative isolate hidden min-h-screen overflow-hidden bg-[#24392f] p-12 text-white lg:flex lg:flex-col xl:p-16">
        <div className="decorative-grid absolute inset-0 opacity-50" />
        <div className="absolute -right-48 top-12 h-[600px] w-[600px] rounded-full border border-white/10" />
        <div className="absolute -right-32 top-28 h-[480px] w-[480px] rounded-full border border-white/10" />
        <div className="absolute -right-16 top-44 h-[360px] w-[360px] rounded-full border border-white/10" />
        <div className="absolute bottom-[-130px] left-[-120px] h-[420px] w-[420px] rounded-full bg-vermilion-600/20 blur-3xl" />
        <div className="archive-login-document" aria-hidden="true"><span className="archive-login-document-kicker">历史档案 / VOL. 01</span><span className="archive-login-document-title">循迹<br />而行</span><span className="archive-login-document-rule" /><span className="archive-login-document-bottom">中国道路档案馆 · 寻路</span></div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-vermilion-600 font-serif text-2xl font-bold">路</div>
          <div>
            <div className="font-serif text-xl font-semibold tracking-[0.12em]">寻路</div>
            <div className="text-[10px] font-semibold tracking-[0.22em] text-white/45">THE PATH ARCHIVE</div>
          </div>
        </div>

        <div className="relative z-10 my-auto max-w-xl py-14">
          <div className="mb-8 flex items-center gap-3">
            <span className="h-px w-12 bg-vermilion-400" />
            <span className="text-xs font-semibold tracking-[0.22em] text-[#eccd9e]">毛概课程 · 历史档案探究</span>
          </div>
          <h1 className="font-serif text-5xl font-semibold leading-[1.35] tracking-tight xl:text-6xl">
            每一个理论，<br /><span className="text-[#e4c193]">都有来时的路。</span>
          </h1>
          <p className="mt-8 max-w-md text-base leading-8 text-white/60">
            读历史档案，整理关键线索，理解毛泽东思想和中国特色社会主义理论体系怎样从中国实践中形成。
          </p>

          <div className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-white/15 pt-7">
            {[
              ["01", "打开档案", "回到历史现场"],
              ["02", "整理线索", "连起实践与理论"],
              ["03", "写下发现", "留下自己的理解"],
            ].map(([number, title, caption]) => (
              <div key={number}>
                <div className="font-serif text-2xl text-vermilion-300">{number}</div>
                <div className="mt-2 text-sm font-semibold">{title}</div>
                <div className="mt-1 text-xs leading-5 text-white/45">{caption}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-white/35">
          <span>寻路 · 中国道路档案馆</span>
          <span>READ · CONNECT · DISCOVER</span>
        </div>
      </section>

      <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-12 xl:px-20">
        <div className="flex items-center gap-2 lg:invisible">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-vermilion-600 font-serif text-xl font-bold text-white">路</span>
          <span className="font-serif text-lg font-semibold">寻路 <span className="ml-1 font-sans text-[10px] tracking-[0.2em] text-ink-400">THE PATH ARCHIVE</span></span>
        </div>

        <div className="mx-auto my-auto w-full max-w-[420px] py-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-vermilion-200 bg-vermilion-50 px-3 py-1.5 text-xs font-medium text-vermilion-700">
            <Sparkles size={14} /> 你的历史档案探究室
          </div>
          <h2 className="mt-4 font-serif text-3xl font-semibold text-ink-900 sm:text-4xl">
            {tab === "login" ? "欢迎回来。" : "开始新的探索。"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-ink-500">
            {tab === "login" ? "登录后，接着翻阅你的历史档案。" : "创建账号，记录属于你的每一次发现。"}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1" role="tablist" aria-label="登录或注册">
            {(["login", "register"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                onClick={() => switchTab(item)}
                className={[
                  "rounded-lg py-2.5 text-sm font-semibold transition",
                  tab === item ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800",
                ].join(" ")}
              >
                {item === "login" ? "登录账号" : "创建账号"}
              </button>
            ))}
          </div>

          <form className="mt-7 space-y-5" onSubmit={submit}>
            {tab === "login" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink-700">邮箱或用户名</span>
                <input className="input" autoComplete="username" placeholder="输入邮箱或用户名" value={account} onChange={(event) => setAccount(event.target.value)} minLength={2} maxLength={255} required />
              </label>
            ) : (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink-700">邮箱</span>
                  <input className="input" type="email" autoComplete="email" placeholder="your@email.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink-700">用户名</span>
                  <input className="input" autoComplete="username" placeholder="2–32 个字符" value={username} onChange={(event) => setUsername(event.target.value)} minLength={2} maxLength={32} required />
                </label>
              </>
            )}
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink-700">密码</span>
              <span className="relative block">
                <LockKeyhole size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  className="input !pl-10 !pr-11"
                  type={showPassword ? "text" : "password"}
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
                  placeholder={tab === "login" ? "输入密码" : "至少 8 个字符"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={tab === "login" ? 1 : 8}
                  maxLength={72}
                  required
                />
                <button type="button" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:text-ink-700">
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            {error && <div role="alert" className="rounded-xl border border-vermilion-200 bg-vermilion-50 px-4 py-3 text-sm text-vermilion-700">{error}</div>}
            <button className="btn-primary !h-12 w-full !text-base" disabled={loading} type="submit">
              {loading ? "请稍候…" : tab === "login" ? "进入档案馆" : "创建账号并开始"}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-3 text-xs text-ink-400">
            <span className="h-px flex-1 bg-ink-200" />
            每一次认真回答，都算数
            <span className="h-px flex-1 bg-ink-200" />
          </div>
        </div>

        <div className="text-center text-xs text-ink-400">寻路 · 中国道路档案馆</div>
      </section>
    </main>
  );
}
