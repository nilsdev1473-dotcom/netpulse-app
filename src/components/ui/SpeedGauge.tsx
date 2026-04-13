"use client";

interface SpeedGaugeProps {
  value: number;
  max?: number;
  label: string;
  color?: string;
  size?: number;
}

// Arc constants — fixed geometry, scaled via viewBox + width/height
const RADIUS = 65;
const CX = 80;
const CY = 90;
// Full semicircle arc length = π * r
const ARC_LENGTH = Math.PI * RADIUS; // ≈ 204.2
// Use a large gap value so the "gap" never wraps
const GAP = ARC_LENGTH * 2;

// Semicircle path: left (15,90) → counterclockwise through top → right (145,90)
// large-arc=1, sweep=0 draws the upper half
const ARC_PATH = `M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 1 0 ${CX + RADIUS} ${CY}`;

export function SpeedGauge({
  value,
  max = 1000,
  label,
  color = "#00E5FF",
  size = 160,
}: SpeedGaugeProps) {
  const pct = Math.min(Math.max(value / max, 0), 1);
  const filled = pct * ARC_LENGTH;

  const displayNum =
    value >= 1000
      ? (value / 1000).toFixed(2)
      : value >= 100
      ? Math.round(value).toString()
      : value.toFixed(1);

  return (
    <svg
      // viewBox is always 160×100; size prop scales the rendered element
      width={size}
      height={Math.round(size * 0.625)} // 160:100 → 8:5 ratio
      viewBox="0 0 160 100"
      aria-label={`${label}: ${displayNum} Mbps`}
    >
      {/* ── Track arc ───────────────────────────────────── */}
      <path
        d={ARC_PATH}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={14}
        strokeLinecap="round"
        strokeDasharray={`${ARC_LENGTH} ${GAP}`}
      />

      {/* ── Progress arc (animated via stroke-dasharray) ── */}
      <path
        d={ARC_PATH}
        fill="none"
        stroke={color}
        strokeWidth={14}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${GAP}`}
        style={{
          transition: "stroke-dasharray 0.4s ease-out",
          filter: `drop-shadow(0 0 8px ${color})`,
        }}
      />

      {/* ── Value number (center of arc, y≈80) ───────────── */}
      <text
        x={CX}
        y={76}
        textAnchor="middle"
        dominantBaseline="auto"
        fill={color}
        fontSize={36}
        fontFamily="'JetBrains Mono', 'Courier New', monospace"
        fontWeight="600"
      >
        {displayNum}
      </text>

      {/* ── Unit label ────────────────────────────────────── */}
      <text
        x={CX}
        y={87}
        textAnchor="middle"
        dominantBaseline="auto"
        fill="rgba(255,255,255,0.5)"
        fontSize={10}
        fontFamily="'JetBrains Mono', 'Courier New', monospace"
      >
        Mbps
      </text>

      {/* ── Channel label ─────────────────────────────────── */}
      <text
        x={CX}
        y={97}
        textAnchor="middle"
        dominantBaseline="auto"
        fill="rgba(255,255,255,0.3)"
        fontSize={9}
        fontFamily="'JetBrains Mono', 'Courier New', monospace"
        letterSpacing="0.12em"
      >
        {label.toUpperCase()}
      </text>
    </svg>
  );
}
