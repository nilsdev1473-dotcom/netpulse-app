import { useEffect, useRef, useState } from "react";

interface SpeedGaugeProps {
  value: number;
  max?: number;
  label: string;
  color?: string;
  size?: number;
}

export function SpeedGauge({
  value,
  max = 1000,
  label,
  color = "#00E5FF",
  size = 200,
}: SpeedGaugeProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smooth value animation
  useEffect(() => {
    const start = displayValue;
    const end = Math.min(value, max);
    const duration = 600;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(start + (end - start) * eased);
      if (progress < 1) {
        animRef.current = setTimeout(() => animate(performance.now()), 16);
      }
    };

    animRef.current = setTimeout(() => animate(performance.now()), 0);
    return () => {
      if (animRef.current) clearTimeout(animRef.current);
    };
  }, [value, max]); // eslint-disable-line react-hooks/exhaustive-deps

  const cx = size / 2;
  const cy = size * 0.58;
  const radius = size * 0.38;
  const strokeWidth = size * 0.045;

  // Half-circle arc: from 180° to 0° (left to right, bottom half open)
  const startAngle = -180; // degrees
  const endAngle = 0;
  const totalAngle = endAngle - startAngle; // 180°

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const arcPath = (start: number, end: number) => {
    const s = toRad(start);
    const e = toRad(end);
    const x1 = cx + radius * Math.cos(s);
    const y1 = cy + radius * Math.sin(s);
    const x2 = cx + radius * Math.cos(e);
    const y2 = cy + radius * Math.sin(e);
    const largeArc = Math.abs(end - start) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const pct = Math.min(displayValue / max, 1);
  const valueAngle = startAngle + pct * totalAngle;

  // Needle endpoint
  const needleLen = radius * 0.85;
  const needleX = cx + needleLen * Math.cos(toRad(valueAngle));
  const needleY = cy + needleLen * Math.sin(toRad(valueAngle));

  // Tick marks
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  // Format display number
  const displayNum =
    displayValue >= 1000
      ? `${(displayValue / 1000).toFixed(2)}`
      : displayValue >= 100
      ? `${Math.round(displayValue)}`
      : `${displayValue.toFixed(1)}`;

  const displayUnit = displayValue >= 1000 ? "Gbps" : "Mbps";

  const filterId = `glow-${color.replace("#", "")}`;

  return (
    <svg
      width={size}
      height={size * 0.75}
      viewBox={`0 0 ${size} ${size * 0.75}`}
      aria-label={`${label}: ${displayNum} ${displayUnit}`}
    >
      <defs>
        <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feColorMatrix
            type="matrix"
            values={
              color === "#00FF87"
                ? "0 0 0 0 0  0 1 0 0 0.53  0 0 0 0 0.53  0 0 0 1 0"
                : "0 0 0 0 0  0 0 0 0 0.9  0 0 0 0 1  0 0 0 1 0"
            }
            in="blur"
            result="colorBlur"
          />
          <feMerge>
            <feMergeNode in="colorBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <linearGradient id={`arc-grad-${filterId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* Track arc */}
      <path
        d={arcPath(startAngle, endAngle)}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Value arc */}
      {pct > 0 && (
        <path
          d={arcPath(startAngle, valueAngle)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          filter={`url(#${filterId})`}
          style={{ transition: "d 0.4s cubic-bezier(0.4,0,0.2,1)" }}
        />
      )}

      {/* Tick marks */}
      {ticks.map((t) => {
        const angle = toRad(startAngle + t * totalAngle);
        const inner = radius - strokeWidth * 0.8;
        const outer = radius + strokeWidth * 0.3;
        return (
          <line
            key={t}
            x1={cx + inner * Math.cos(angle)}
            y1={cy + inner * Math.sin(angle)}
            x2={cx + outer * Math.cos(angle)}
            y2={cy + outer * Math.sin(angle)}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1.5}
          />
        );
      })}

      {/* Needle */}
      <line
        x1={cx}
        y1={cy}
        x2={needleX}
        y2={needleY}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        filter={`url(#${filterId})`}
        style={{ transition: "x2 0.4s cubic-bezier(0.4,0,0.2,1), y2 0.4s cubic-bezier(0.4,0,0.2,1)" }}
      />

      {/* Needle hub */}
      <circle cx={cx} cy={cy} r={size * 0.025} fill={color} opacity={0.9} />

      {/* Center number */}
      <text
        x={cx}
        y={cy - size * 0.08}
        textAnchor="middle"
        dominantBaseline="auto"
        fill="rgba(255,255,255,0.92)"
        fontSize={size * 0.14}
        fontFamily="'JetBrains Mono', 'Courier New', monospace"
        fontWeight="600"
      >
        {displayNum}
      </text>

      {/* Unit */}
      <text
        x={cx}
        y={cy - size * 0.04}
        textAnchor="middle"
        dominantBaseline="auto"
        fill={color}
        fontSize={size * 0.065}
        fontFamily="'JetBrains Mono', 'Courier New', monospace"
        opacity={0.8}
      >
        {displayUnit}
      </text>

      {/* Label */}
      <text
        x={cx}
        y={cy + size * 0.08}
        textAnchor="middle"
        dominantBaseline="auto"
        fill="rgba(255,255,255,0.45)"
        fontSize={size * 0.055}
        fontFamily="'JetBrains Mono', 'Courier New', monospace"
        letterSpacing="0.08em"
      >
        {label.toUpperCase()}
      </text>
    </svg>
  );
}
