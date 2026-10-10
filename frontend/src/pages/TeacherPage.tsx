import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BarChart3, CircleAlert, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../lib/api";
import { useAuthStore } from "../stores/auth";
import type { User } from "../lib/types";

interface TeacherTotals {
  students: number;
  records: number;
  attempts: number;
  passed: number;
  notes_saved: number;
  probe_passed: number;
}

interface TeacherCaseRow {
  case_code: string;
  title: string;
  chapter: string;
  students: number;
  attempts: number;
  passed: number;
  notes: number;
  pass_rate: number | null;
}

interface TeacherCardRow {
  case_code: string;
  case_title: string;
  card_id: string;
  label: string;
  attempts: number;
  errors: number;
  error_rate: number;
  stage_errors: number;
  order_errors: number;
  triage_errors: number;
  is_distractor: boolean;
}

interface TeacherOverview {
  totals: TeacherTotals;
  cases: TeacherCaseRow[];
  cards: TeacherCardRow[];
  note: string;
}

export default function TeacherPage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [overview, setOverview] = useState<TeacherOverview | null>(null);
  const [needClaim, setNeedClaim] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await api.get<TeacherOverview>("/teacher/overview");
      setOverview(response.data);
      setNeedClaim(false);
    } catch (err) {
      setOverview(null);
      setNeedClaim(true);
      if (user?.is_superuser) setError(apiErrorMessage(err));
    }
  }, [user?.is_superuser]);

  useEffect(() => {
    load();
  }, [load]);

  const claim = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.trim().length < 4 || busy) return;
    setBusy(true); setError("");
    try {
      await api.post<User>("/users/me/teacher", { code: code.trim() });
      const me = await api.get<User>("/auth/me");
      setUser(me.data);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!overview) {
    return (
      <div className="archive-page space-y-6">
        <Link to="/" className="inline-flex items-center gap-1 text-xs font-medium text-[#7f766a] hover:text-[#a5523c]">
          <ArrowLeft size={15} /> 返回探索首页
        </Link>
        <div className="archive-panel mx-auto max-w-xl p-6 sm:p-8">
          <div className="archive-eyebrow">TEACHER ACCESS</div>
          <h1 className="mt-2 flex items-center gap-2 font-serif text-2xl font-semibold text-[#273a31]">
            <GraduationCap size={22} className="text-[#a8543d]" /> 教师看板
          </h1>
          {needClaim ? (
            <>
              <p className="mt-3 text-sm leading-7 text-[#7d7264]">
                教师看板展示班级层面的匿名汇总与错卡热力图，需要课程负责人提供的验证码。数据只做聚合，不含账号信息与笔记正文。
              </p>
              {error && <div role="alert" className="archive-error mt-3"><CircleAlert size={17} /> {error}</div>}
              <form className="mt-5 flex flex-wrap items-center gap-3" onSubmit={claim}>
                <input
                  className="archive-input max-w-xs"
                  type="password"
                  aria-label="教师验证码"
                  placeholder="输入教师验证码"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
                <button className="archive-button" type="submit" disabled={busy || code.trim().length < 4}>
                  {busy ? "验证中…" : "进入看板"}
                </button>
              </form>
            </>
          ) : (
            <p className="mt-3 text-sm text-[#8a8072]">正在汇总班级数据…</p>
          )}
        </div>
      </div>
    );
  }

  const totals = overview.totals;
  const cards = overview.cards;

  return (
    <div className="archive-page space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-xs font-medium text-[#7f766a] hover:text-[#a5523c]">
        <ArrowLeft size={15} /> 返回探索首页
      </Link>

      <header className="archive-panel p-6 sm:p-7">
        <div className="archive-eyebrow">TEACHER DASHBOARD</div>
        <h1 className="mt-2 flex items-center gap-2 font-serif text-[27px] font-semibold text-[#273a31]">
          <BarChart3 size={24} className="text-[#a8543d]" /> 教师看板
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#7d7264]">
          班级层面的匿名汇总：哪些档案通过率偏低、哪些卡片最容易被错放或漏剔除。用于备课时决定先讲哪一段史实。{overview.note}
        </p>
      </header>

      {error && <div role="alert" className="archive-error"><CircleAlert size={17} /> {error}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "参与学生", value: totals.students },
          { label: "进度记录", value: totals.records },
          { label: "核对次数", value: totals.attempts },
          { label: "通关档案", value: totals.passed },
          { label: "完成笔记", value: totals.notes_saved },
          { label: "追问通过", value: totals.probe_passed },
        ].map((item) => (
          <div key={item.label} className="archive-panel px-4 py-3">
            <div className="text-[11px] text-[#9a8d7a]">{item.label}</div>
            <div className="mt-1 font-serif text-2xl font-semibold text-[#2e4034]">{item.value}</div>
          </div>
        ))}
      </div>

      <section className="archive-panel p-5 sm:p-6">
        <h2 className="font-serif text-xl font-semibold text-[#2e4034]">各档案通过情况</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="border-b border-[#e6dcc9] text-left text-[#9a8d7a]">
                <th className="py-2 pr-3 font-medium">档案</th>
                <th className="py-2 pr-3 font-medium">参与学生</th>
                <th className="py-2 pr-3 font-medium">核对次数</th>
                <th className="py-2 pr-3 font-medium">通关</th>
                <th className="py-2 pr-3 font-medium">笔记</th>
                <th className="py-2 font-medium">通过率</th>
              </tr>
            </thead>
            <tbody>
              {overview.cases.map((row) => (
                <tr key={row.case_code} className="border-b border-[#f0e8da]">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-[#3a4a3f]">{row.title}</div>
                    <div className="text-[10px] text-[#a2968a]">{row.chapter}</div>
                  </td>
                  <td className="py-2 pr-3">{row.students}</td>
                  <td className="py-2 pr-3">{row.attempts}</td>
                  <td className="py-2 pr-3">{row.passed}</td>
                  <td className="py-2 pr-3">{row.notes}</td>
                  <td className="py-2">
                    {row.pass_rate === null ? "—" : `${Math.round(row.pass_rate * 100)}%`}
                  </td>
                </tr>
              ))}
              {overview.cases.length === 0 && (
                <tr><td className="py-4 text-[#a2968a]" colSpan={6}>还没有学生进度数据。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="archive-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-serif text-xl font-semibold text-[#2e4034]">错卡热力图</h2>
          <span className="text-[11px] text-[#9a8d7a]">按错误率排序，最多展示 {cards.length} 张卡片</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-[#e6dcc9] text-left text-[#9a8d7a]">
                <th className="py-2 pr-3 font-medium">卡片</th>
                <th className="py-2 pr-3 font-medium">档案</th>
                <th className="py-2 pr-3 font-medium">类型</th>
                <th className="py-2 pr-3 font-medium">出现次数</th>
                <th className="py-2 pr-3 font-medium">归类错</th>
                <th className="py-2 pr-3 font-medium">顺序错</th>
                <th className="py-2 pr-3 font-medium">漏剔除</th>
                <th className="py-2 font-medium">错误率</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.card_id} className="border-b border-[#f0e8da]">
                  <td className="py-2 pr-3 font-medium text-[#3a4a3f]">{card.label}</td>
                  <td className="py-2 pr-3 text-[#7d7264]">{card.case_title}</td>
                  <td className="py-2 pr-3">
                    <span className={"archive-tag " + (card.is_distractor ? "is-reject" : "is-context")}>
                      {card.is_distractor ? "干扰卡" : "普通卡"}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{card.attempts}</td>
                  <td className="py-2 pr-3">{card.stage_errors}</td>
                  <td className="py-2 pr-3">{card.order_errors}</td>
                  <td className="py-2 pr-3">{card.triage_errors}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded bg-[#efe6d6]">
                        <div
                          className={"h-1.5 rounded " + (card.error_rate >= 0.5 ? "bg-[#b45f45]" : card.error_rate > 0 ? "bg-[#c19a6b]" : "bg-[#7ea071]")}
                          style={{ width: `${Math.round(card.error_rate * 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-[#7d7264]">{Math.round(card.error_rate * 100)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {cards.length === 0 && (
                <tr><td className="py-4 text-[#a2968a]" colSpan={8}>还没有核对记录，学生开始探索后这里会显示每张卡片的错误分布。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
