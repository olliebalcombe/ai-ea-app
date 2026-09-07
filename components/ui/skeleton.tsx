import { cn } from "@/lib/utils"

/** Shimmer placeholder block -- shape/size it per use via className. Respects reduced-motion (no pulse, just the static surface). */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("motion-safe:animate-pulse rounded-md bg-white/[0.06]", className)}
      {...props}
    />
  )
}

export { Skeleton }
