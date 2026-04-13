import { useEffect, useRef } from "react";

interface NetworkGraphProps {
  data: number[];
  color?: string;
  height?: number;
}

export function NetworkGraph({
  data,
  color = "#00E5FF",
  height = 80,
}: NetworkGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const dataRef = useRef<number[]>(data);

  // Keep dataRef up to date
  dataRef.current = data;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const points = dataRef.current.slice(-60);

      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = "rgba(15,15,18,0)";
      ctx.fillRect(0, 0, w, h);

      // Grid lines (horizontal)
      const gridLines = 4;
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let i = 1; i < gridLines; i++) {
        const y = (h / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Vertical grid lines (time markers every ~15 points)
      const vLines = 4;
      for (let i = 1; i < vLines; i++) {
        const x = (w / vLines) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      if (points.length < 2) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const maxVal = Math.max(...points, 1);
      const padding = { top: 6, bottom: 6 };
      const usableH = h - padding.top - padding.bottom;

      const xStep = w / (60 - 1);
      // Offset so data scrolls from right
      const xOffset = (60 - points.length) * xStep;

      const getX = (i: number) => xOffset + i * xStep;
      const getY = (v: number) =>
        padding.top + usableH - (v / maxVal) * usableH;

      // Glow line
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      ctx.beginPath();
      points.forEach((v, i) => {
        const x = getX(i);
        const y = getY(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();

      // Filled area gradient
      const grad = ctx.createLinearGradient(0, padding.top, 0, h);
      grad.addColorStop(0, color.replace(")", ", 0.18)").replace("rgb", "rgba").replace("#", "rgba(").replace("rgba(", "rgba(") || `${color}30`);
      grad.addColorStop(1, "transparent");

      // Build hex->rgba helper inline
      const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
      };

      const areaGrad = ctx.createLinearGradient(0, padding.top, 0, h);
      areaGrad.addColorStop(0, hexToRgba(color.startsWith("#") ? color : "#00E5FF", 0.15));
      areaGrad.addColorStop(1, hexToRgba(color.startsWith("#") ? color : "#00E5FF", 0));

      ctx.beginPath();
      points.forEach((v, i) => {
        const x = getX(i);
        const y = getY(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      // Close the area
      ctx.lineTo(getX(points.length - 1), h);
      ctx.lineTo(getX(0), h);
      ctx.closePath();
      ctx.fillStyle = areaGrad;
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [color]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        canvas.width = entry.contentRect.width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        canvas.style.width = `${entry.contentRect.width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    });

    ro.observe(parent);
    // Initial size
    canvas.width = parent.clientWidth * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${parent.clientWidth}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    return () => ro.disconnect();
  }, [height]);

  return (
    <div
      className="w-full overflow-hidden rounded-lg"
      style={{ height, background: "rgba(15,15,18,0.6)" }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: `${height}px` }}
      />
    </div>
  );
}
