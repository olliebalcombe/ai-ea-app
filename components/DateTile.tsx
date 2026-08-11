/** Small stylized month/day badge with a time tag underneath, for booking cards and lists. */
export default function DateTile({ date, time }: { date: string | null; time: string | null }) {
  if (!date) {
    return (
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-black/20 text-muted-foreground">
        <span className="text-[10px] font-medium uppercase">TBC</span>
      </div>
    );
  }

  const d = new Date(`${date}T00:00:00`);
  const month = d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
  const day = d.getDate();

  return (
    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/25">
      <span className="w-full bg-primary/15 py-0.5 text-center text-[10px] font-semibold tracking-wide text-primary">
        {month}
      </span>
      <span className="flex-1 pt-0.5 text-lg font-semibold leading-none text-foreground">{day}</span>
      {time && <span className="pb-1 text-[9px] text-muted-foreground">{time}</span>}
    </div>
  );
}
