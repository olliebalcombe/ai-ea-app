export default function ViewportFrame({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-xl border border-white/10 bg-black/30 shadow-2xl shadow-black/40 ${className ?? ""}`}>
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        </div>
        {title && (
          <div className="ml-2 flex-1 truncate rounded-md bg-black/25 px-2.5 py-0.5 text-center text-[11px] text-muted-foreground">
            {title}
          </div>
        )}
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
