import { useEffect, useRef, useState } from "react";
import { Archive, ArrowUpRight, BookMarked, Compass, GraduationCap, LogOut, Menu, MessageCircle, NotebookPen, Route, X } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/auth";
import BrandLogo from "./BrandLogo";

const nav = [
  { to: "/", label: "探索首页", icon: Compass, sub: "从一条线索出发" },
  { to: "/archives", label: "档案关卡", icon: Archive, sub: "走进历史现场" },
  { to: "/threads", label: "档案主线", icon: Route, sub: "把线索连成脉络" },
  { to: "/knowledge", label: "理论手册", icon: BookMarked, sub: "把知识连起来" },
  { to: "/journal", label: "我的发现", icon: NotebookPen, sub: "记录探索足迹" },
  { to: "/chat", label: "聊天助手", icon: MessageCircle, sub: "答疑、咨询，或聊聊今天" },
];

const teacherNav = { to: "/teacher", label: "教师看板", icon: GraduationCap, sub: "错卡热力图" };

export default function Layout() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) api.get("/auth/me").then((result) => setUser(result.data)).catch(() => undefined);
  }, [user, setUser]);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const elements = () => Array.from(drawerRef.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)") ?? []);
    elements()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const focusable = elements();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", handleKey); previousFocus?.focus(); };
  }, [open]);

  const signOut = async () => {
    try {
      if (refreshToken) await api.post("/auth/logout", { refresh_token: refreshToken });
    } catch { /* The local session must still end. */ }
    logout();
    navigate("/login", { replace: true });
  };

  const items = user?.is_superuser ? [...nav, teacherNav] : nav;

  const sidebar = (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center justify-between px-7 pb-8 pt-8">
        <Link to="/" aria-label="寻路首页" onClick={() => setOpen(false)}><BrandLogo inverse /></Link>
        <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white" type="button" aria-label="关闭导航" onClick={() => setOpen(false)}><X size={20} /></button>
      </div>
      <div className="px-7 text-[10px] tracking-[.22em] text-[#afa897]">EXPLORE / 探索目录</div>
      <nav aria-label="主导航" className="mt-4 space-y-1 px-3">
        {items.map(({ to, label, sub, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)} className={({ isActive }) => "archive-nav " + (isActive ? "archive-nav-active" : "")}>
            <Icon size={19} strokeWidth={1.7} />
            <span><strong className="block text-sm font-medium">{label}</strong><small className="mt-0.5 block text-[11px] opacity-55">{sub}</small></span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto px-5 pb-6">
        <div className="rounded-2xl border border-white/10 bg-white/[.05] p-5">
          <span className="text-[10px] tracking-[.18em] text-[#d9b685]">探索者寄语</span>
          <p className="mt-3 font-serif text-[17px] leading-7 text-white">从历史条件出发，<br />才能理解理论从何而来。</p>
          <Link to="/archives" onClick={() => setOpen(false)} className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#e9c9a1]">打开档案 <ArrowUpRight size={14} /></Link>
        </div>
        <div className="mt-5 flex items-center gap-3 px-2 text-white/80">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c6bca6] font-serif text-sm text-[#2c352f]">{user?.username?.slice(0, 1) ?? "我"}</span>
          <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-medium">{user?.username ?? "探索者"}</strong><small className="text-[11px] opacity-50">继续你的发现</small></span>
          <button type="button" onClick={signOut} aria-label="退出登录" title="退出登录" className="rounded-lg p-2 hover:bg-white/10"><LogOut size={17} /></button>
        </div>
      </div>
    </div>
  );

  const pageName = location.pathname.startsWith("/archives/") ? "档案现场" : items.find((item) => item.to === location.pathname)?.label ?? "寻路";
  return (
    <div className="min-h-screen bg-[#f5f1e8]">
      <a href="#main-content" className="archive-skip-link">跳转到正文</a>
      <div className="min-w-0">
        <header className="archive-app-header sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[#dfd8ca] bg-[#f5f1e8]/95 px-4 backdrop-blur sm:px-9">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <button className="archive-navigation-trigger" type="button" aria-label="打开导航" title="打开导航" aria-expanded={open} aria-controls="archive-navigation" onClick={() => setOpen((value) => !value)}><Menu size={21} /><span className="hidden text-xs font-medium sm:block">目录</span></button>
            <Link to="/" aria-label="寻路首页" className="shrink-0"><BrandLogo compact /></Link>
            <span className="archive-header-page hidden text-xs text-[#817667] sm:block">{pageName}</span>
          </div>
          <div className="flex items-center gap-4"><span className="hidden items-center gap-2 text-xs text-[#7d776a] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#b96545]" /> 毛概课程历史探究</span><Link to="/journal" aria-label="查看我的发现" className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d9cbb5] bg-[#eee1cc] font-serif text-sm text-[#6e5842]">{user?.username?.slice(0, 1) ?? "我"}</Link></div>
        </header>
        <main id="main-content" tabIndex={-1} className="archive-main mx-auto max-w-[1300px] px-4 py-6 sm:px-8 sm:py-8 lg:px-10"><Outlet /></main>
      </div>
      <nav aria-label="快捷导航" className="archive-mobile-tabs lg:hidden">
        {items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => "archive-mobile-tab " + (isActive ? "is-active" : "")}><Icon size={20} strokeWidth={1.7} /><span>{label}</span></NavLink>)}
      </nav>
      {open && <div className="archive-navigation-backdrop fixed inset-0 z-50 bg-[#17221d]/60" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><aside id="archive-navigation" ref={drawerRef} role="dialog" aria-modal="true" aria-label="导航菜单" className="archive-sidebar archive-navigation-drawer h-full w-[min(320px,86vw)] overflow-y-auto">{sidebar}</aside></div>}
    </div>
  );
}
