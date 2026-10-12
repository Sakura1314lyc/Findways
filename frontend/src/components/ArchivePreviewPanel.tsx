import { useEffect, useRef } from "react";
import { ArrowUpRight, Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { ArchiveCase, ArchiveProgress } from "../lib/archive";

interface Props {
  archive: ArchiveCase;
  number: number;
  progress?: ArchiveProgress;
  onDismiss: () => void;
}

export default function ArchivePreviewPanel({ archive, number, progress, onDismiss }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const completed = Boolean(progress?.completed_at);
  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    panelRef.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, []);
  return <section ref={panelRef} id={"archive-preview-" + archive.code} className="archive-inline-preview" aria-labelledby={"archive-preview-title-" + archive.code}>
    <div className="archive-inline-preview-sheet">
      <button type="button" className="archive-preview-close" aria-label="收起档案介绍" onClick={onDismiss}><X size={19} /></button>
      <div className="archive-preview-meta"><span>档案 NO.{String(number).padStart(2, "0")}</span><span className={"archive-preview-status " + (completed ? "is-complete" : progress ? "is-started" : "")}>{completed && <Check size={12} />}{completed ? "已完成" : progress ? "探索中" : "待开启"}</span></div>
      <h2 id={"archive-preview-title-" + archive.code} className="archive-preview-title">{archive.title}</h2>
      <p className="archive-preview-description">{archive.subtitle}</p>
      <div className="archive-preview-context"><span>{archive.chapter}</span><span>历史情境 / {archive.era}</span></div>
      <Link to={"/archives/" + archive.code} className="archive-preview-enter"><span>进入探索</span><ArrowUpRight size={21} /></Link>
    </div>
  </section>;
}
