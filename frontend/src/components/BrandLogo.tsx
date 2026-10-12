interface Props {
  inverse?: boolean;
  compact?: boolean;
  className?: string;
}

export default function BrandLogo({ inverse = false, compact = false, className = "" }: Props) {
  return <span className={`xunlu-brand ${inverse ? "is-inverse" : ""} ${compact ? "is-compact" : ""} ${className}`} role="img" aria-label="寻路 · 中国道路档案馆">
    <img className="xunlu-brand-mark" src="/xunlu-mark.svg" width="64" height="64" alt="" />
    <span className="xunlu-brand-type"><strong>寻路</strong><small>中国道路档案馆</small></span>
  </span>;
}
