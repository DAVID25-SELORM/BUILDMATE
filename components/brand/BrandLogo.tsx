type BrandLogoProps = {
  inverse?: boolean;
  compact?: boolean;
  className?: string;
};

export function BrandLogo({ inverse = false, compact = false, className = "" }: BrandLogoProps) {
  return <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="BuildMate Ghana">
    <svg aria-hidden="true" className="h-9 w-9 shrink-0" viewBox="0 0 64 64" role="img">
      <rect width="64" height="64" rx="14" fill={inverse ? "#ffffff" : "#176b3a"} />
      <path d="M14 46V24l18-10 18 10v22H38V33H26v13H14Z" fill={inverse ? "#176b3a" : "#ffffff"} />
      <path d="M10 50h44" stroke="#f4b942" strokeWidth="5" strokeLinecap="round" />
    </svg>
    {!compact && <span className={`leading-none ${inverse ? "text-white" : "text-brand-800"}`}>
      <span className="block text-xl font-black tracking-tight">BuildMate</span>
      <span className={`mt-1 block text-[0.6rem] font-bold uppercase tracking-[0.18em] ${inverse ? "text-brand-100" : "text-slate-500"}`}>Ghana</span>
    </span>}
  </span>;
}
