import { cn } from "../../lib/utils";

interface VPNBadgeProps {
  detected: boolean;
  confidence: number;
  reason: string;
}

export function VPNBadge({ detected, confidence, reason }: VPNBadgeProps) {
  return (
    <div
      className={cn(
        "relative inline-flex flex-col gap-1.5 px-4 py-3 rounded-xl",
        "border backdrop-blur-sm",
        "transition-all duration-500",
        detected
          ? "bg-amber-500/10 border-amber-500/25 shadow-[0_0_20px_rgba(255,170,0,0.08)]"
          : "bg-emerald-500/10 border-emerald-500/25 shadow-[0_0_20px_rgba(0,255,135,0.08)]"
      )}
    >
      {/* Main status row */}
      <div className="flex items-center gap-2.5">
        {/* Pulsing indicator dot */}
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75",
              detected
                ? "bg-amber-400 animate-ping"
                : "bg-emerald-400"
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-2.5 w-2.5 rounded-full",
              detected ? "bg-amber-400" : "bg-emerald-400"
            )}
          />
        </span>

        {/* Status text */}
        <span
          className={cn(
            "font-mono text-sm font-semibold tracking-widest uppercase",
            detected ? "text-amber-300" : "text-emerald-300"
          )}
        >
          {detected ? "⚠ VPN ON" : "✓ DIRECT"}
        </span>

        {/* Confidence chip */}
        <span
          className={cn(
            "ml-auto font-mono text-xs px-2 py-0.5 rounded-md",
            detected
              ? "bg-amber-500/15 text-amber-400/80"
              : "bg-emerald-500/15 text-emerald-400/80"
          )}
        >
          {Math.round(confidence * 100)}%
        </span>
      </div>

      {/* Reason text */}
      <p
        className={cn(
          "text-xs font-mono leading-relaxed pl-5",
          detected ? "text-amber-200/50" : "text-emerald-200/50"
        )}
      >
        {reason}
      </p>

      {/* Animated border glow when VPN detected */}
      {detected && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl border border-amber-400/20 animate-pulse"
        />
      )}
    </div>
  );
}
