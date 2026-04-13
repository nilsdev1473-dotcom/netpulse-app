"use client";

interface SpeedGaugeProps {
  value: number;
  max?: number;
  label: string;
  color?: string;
  size?: number;
}

const RADIUS = 60;
const CX = 80;
const CY = 85;
// Half circle circumference = π * r
const CIRC = Math.PI * RADIUS;

export function SpeedGauge({
  value,
  max = 200, // realistic max for home connections
  label,
  color = "#00E5FF",
  size = 160,
}: SpeedGaugeProps) {
  // Clamp ratio 0-1
  const ratio = Math.min(1, Math.max(0, value / max));
  const filled = ratio * CIRC;


  // Half-circle: start at left (20, 85), arc to right (140, 85) going UP (counterclockwise)
  const startX = CX - RADIUS; // 20
  const endX = CX + RADIUS;   // 140
  const arcPath = `M ${startX} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${endX} ${CY}`;

  const displayValue = value >= 1 ? value.toFixed(1) : value.toFixed(2);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <svg
        width={size}
        height={size * 0.65}
        viewBox="0 0 160 105"
        style={{ overflow: "visible" }}
      >
        {/* Glow filter */}
        <defs>
          <filter id={`glow-${label}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track (background arc) */}
        <path
          d={arcPath}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={12}
          strokeLinecap="round"
        />

        {/* Progress arc */}
        <path
          d={arcPath}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${CIRC}`}
          strokeDashoffset={0}
          filter={`url(#glow-${label})`}
          style={{ transition: "stroke-dasharray 0.5s ease-out" }}
        />

        {/* Center value */}
        <text
          x={CX}
          y={CY - 8}
          textAnchor="middle"
          fill={color}
          fontSize={ratio > 0 ? 28 : 24}
          fontWeight="700"
          fontFamily="'JetBrains Mono', monospace"
          style={{ transition: "font-size 0.3s" }}
        >
          {displayValue}
        </text>

        {/* Unit */}
        <text
          x={CX}
          y={CY + 8}
          textAnchor="middle"
          fill="rgba(255,255,255,0.4)"
          fontSize={9}
          fontFamily="'JetBrains Mono', monospace"
          letterSpacing="0.1em"
        >
          Mbps
        </text>

        {/* Label */}
        <text
          x={CX}
          y={CY + 20}
          textAnchor="middle"
          fill="rgba(255,255,255,0.25)"
          fontSize={8}
          fontFamily="'JetBrains Mono', monospace"
          letterSpacing="0.15em"
        >
          {label.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}
