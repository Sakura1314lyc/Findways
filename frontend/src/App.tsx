import { lazy, Suspense, useLayoutEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

const DashboardPage = lazy(() => import("./pages/ArchiveHomePage"));
const ArchivePage = lazy(() => import("./pages/ArchivePage"));
const KnowledgePage = lazy(() => import("./pages/ArchiveKnowledgePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const JournalPage = lazy(() => import("./pages/JournalPage"));
const ArchiveCatalogPage = lazy(() => import("./pages/ArchiveCatalogPage"));
const ThreadsPage = lazy(() => import("./pages/ThreadsPage"));
const TeacherPage = lazy(() => import("./pages/TeacherPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-ink-500">页面加载中…</div>}>
    <ScrollToTop />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/archives" element={<ArchiveCatalogPage />} />
        <Route path="/archives/:code" element={<ArchivePage />} />
        <Route path="/threads" element={<ThreadsPage />} />
        <Route path="/teacher" element={<TeacherPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
