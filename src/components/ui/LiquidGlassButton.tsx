import React from "react";
import { cn } from "../../lib/utils";

interface LiquidGlassButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function LiquidGlassButton({
  children,
  className,
  onClick,
  disabled = false,
}: LiquidGlassButtonProps) {
  return (
    <>
      {/* SVG filter for liquid glass distortion */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id="GlassFilter" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix
              type="saturate"
              values="0"
              in="noise"
              result="grayNoise"
            />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay" result="blend" />
            <feComposite in="blend" in2="SourceGraphic" operator="in" result="comp" />
            <feGaussianBlur stdDeviation="0.5" in="comp" result="blur" />
            <feComposite in="blur" in2="SourceGraphic" operator="over" />
          </filter>
        </defs>
      </svg>

      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          // Base styles
          "relative inline-flex items-center justify-center gap-2",
          "px-5 py-2.5 rounded-xl",
          "text-sm font-medium tracking-wide",
          "transition-all duration-200 ease-out",
          "select-none cursor-pointer",
          // Glass background
          "bg-white/[0.08] backdrop-blur-xl",
          // Border
          "border border-white/[0.12]",
          // Text
          "text-white/90",
          // Shadow — liquid glass values from 21st.dev prompt library
          "shadow-[0_0_8px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3.5px_rgba(255,255,255,0.09),inset_0_0_0_0.5px_rgba(255,255,255,0.08)]",
          "dark:shadow-[0_0_8px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3.5px_rgba(255,255,255,0.09),inset_0_0_0_0.5px_rgba(255,255,255,0.08)]",
          // Hover
          "hover:bg-white/[0.13] hover:border-white/[0.18]",
          "hover:shadow-[0_0_16px_rgba(0,229,255,0.08),0_4px_12px_rgba(0,0,0,0.16),inset_3px_3px_0.5px_-3.5px_rgba(255,255,255,0.14),inset_0_0_0_0.5px_rgba(255,255,255,0.12)]",
          // Active
          "active:scale-[0.98] active:bg-white/[0.06]",
          // Disabled
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
          className
        )}
        style={{ filter: "url(#GlassFilter)" }}
      >
        {/* Inner highlight */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%)",
          }}
        />
        <span className="relative z-10 flex items-center gap-2">{children}</span>
      </button>
    </>
  );
}
