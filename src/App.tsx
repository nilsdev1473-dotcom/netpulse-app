import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SpeedGauge } from "./components/ui/SpeedGauge";
import { VPNBadge } from "./components/ui/VPNBadge";
import { LiquidGlassButton } from "./components/ui/LiquidGlassButton";
import { NetworkGraph } from "./components/ui/NetworkGraph";
import "./App.css";

// ─── Data Structures ────────────────────────────────────────────────────────

interface NetworkInterface {
  name: string;
  bytes_received: number;
  bytes_transmitted: number;
  rx_speed_mbps: number;
  tx_speed_mbps: number;
}

interface IpInfo {
  ip: string;
  isp: string;
  org: string;
  country: string;
  city: string;
  timezone: string;
  vpn_detected: boolean;
  vpn_confidence: number;
}

interface Connection {
  protocol: string;
  local_addr: string;
  remote_addr: string;
  state: string;
}

// ─── Placeholder / Fallback Data ────────────────────────────────────────────

const PLACEHOLDER_INTERFACES: NetworkInterface[] = [
  {
    name: "en0",
    bytes_received: 0,
    bytes_transmitted: 0,
    rx_speed_mbps: 0,
    tx_speed_mbps: 0,
  },
];

const PLACEHOLDER_IP: IpInfo = {
  ip: "0.0.0.0",
  isp: "—",
  org: "—",
  country: "—",
  city: "—",
  timezone: "—",
  vpn_detected: false,
  vpn_confidence: 0,
};

const PLACEHOLDER_CONNECTIONS: Connection[] = [];

// ─── Helpers ────────────────────────────────────────────────────────────────

function maskIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }
  // IPv6 — just truncate
  if (ip.includes(":")) {
    return ip.slice(0, 8) + "…";
  }
  return ip;
}

function getPrimaryInterface(interfaces: NetworkInterface[]): NetworkInterface {
  // Skip loopback; prefer the one with most traffic
  const nonLoopback = interfaces.filter(
    (i) => i.name !== "lo" && i.name !== "lo0" && !i.name.startsWith("loop")
  );
  if (nonLoopback.length === 0) return interfaces[0] ?? PLACEHOLDER_INTERFACES[0];
  return nonLoopback.reduce((best, cur) =>
    cur.rx_speed_mbps + cur.tx_speed_mbps > best.rx_speed_mbps + best.tx_speed_mbps
      ? cur
      : best
  );
}

function stateColor(state: string): string {
  const s = state.toUpperCase();
  if (s === "ESTABLISHED") return "#00FF87";
  if (s === "LISTEN" || s === "LISTENING") return "rgba(255,255,255,0.35)";
  return "#FFAA00";
}

function stateBg(state: string): string {
  const s = state.toUpperCase();
  if (s === "ESTABLISHED") return "rgba(0,255,135,0.12)";
  if (s === "LISTEN" || s === "LISTENING") return "rgba(255,255,255,0.05)";
  return "rgba(255,170,0,0.12)";
}

// ─── Safe invoke wrapper ─────────────────────────────────────────────────────

async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    return await invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  // Network stats
  const [rxSpeed, setRxSpeed] = useState(0);
  const [txSpeed, setTxSpeed] = useState(0);
  const [rxHistory, setRxHistory] = useState<number[]>(Array(60).fill(0));

  // IP / VPN
  const [ipInfo, setIpInfo] = useState<IpInfo>(PLACEHOLDER_IP);

  // Connections
  const [connections, setConnections] = useState<Connection[]>(PLACEHOLDER_CONNECTIONS);

  // Speed test
  const [speedResult, setSpeedResult] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState(false);

  // ── Fetch network stats every 500ms ────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    const result = await safeInvoke<NetworkInterface[]>("get_network_stats");
    const ifaces = result ?? PLACEHOLDER_INTERFACES;
    const primary = getPrimaryInterface(ifaces);
    setRxSpeed(primary.rx_speed_mbps);
    setTxSpeed(primary.tx_speed_mbps);
    setRxHistory((prev) => {
      const next = [...prev.slice(-59), primary.rx_speed_mbps];
      return next;
    });
  }, []);

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 500);
    return () => clearInterval(id);
  }, [fetchStats]);

  // ── Fetch IP info every 30s ────────────────────────────────────────────────
  const fetchIp = useCallback(async () => {
    const result = await safeInvoke<IpInfo>("get_ip_info");
    if (result) setIpInfo(result);
  }, []);

  useEffect(() => {
    fetchIp();
    const id = setInterval(fetchIp, 30_000);
    return () => clearInterval(id);
  }, [fetchIp]);

  // ── Fetch connections every 3s ─────────────────────────────────────────────
  const fetchConnections = useCallback(async () => {
    const result = await safeInvoke<Connection[]>("get_active_connections");
    if (result) setConnections(result);
  }, []);

  useEffect(() => {
    fetchConnections();
    const id = setInterval(fetchConnections, 3_000);
    return () => clearInterval(id);
  }, [fetchConnections]);

  // ── Speed test ─────────────────────────────────────────────────────────────
  const handleMeasureSpeed = async () => {
    setMeasuring(true);
    setSpeedResult(null);
    const result = await safeInvoke<number>("measure_download_speed");
    setSpeedResult(result ?? 0);
    setMeasuring(false);
  };

  // ── Title bar close ────────────────────────────────────────────────────────
  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch {
      // web dev mode — no-op
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#080809",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        color: "rgba(255,255,255,0.92)",
        userSelect: "none",
      }}
    >
      {/* ── Custom Title Bar ─────────────────────────────────────────────── */}
      <TitleBar onClose={handleClose} />

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Zone 1 — VELOCITY (top 30%) */}
        <div
          style={{
            height: "30%",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            flexDirection: "column",
            padding: "0 16px 8px",
          }}
        >
          <ZoneLabel>VELOCITY</ZoneLabel>
          <div style={{ flex: 1, display: "flex", gap: 12, overflow: "hidden" }}>
            {/* Gauges */}
            <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
              <SpeedGauge
                value={rxSpeed}
                max={1000}
                label="Download"
                color="#00E5FF"
                size={150}
              />
              <SpeedGauge
                value={txSpeed}
                max={1000}
                label="Upload"
                color="#00FF87"
                size={150}
              />
            </div>
            {/* Graph */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
              <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
                DOWNLOAD HISTORY — 30s
              </div>
              <NetworkGraph data={rxHistory} color="#00E5FF" height={90} />
            </div>
          </div>
        </div>

        {/* Bottom zones */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Zone 2 — SHIELD (left 40%) */}
          <div
            style={{
              width: "40%",
              borderRight: "1px solid rgba(255,255,255,0.07)",
              padding: "12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              overflow: "hidden",
            }}
          >
            <ZoneLabel>SHIELD</ZoneLabel>

            {/* VPN Badge */}
            <VPNBadge
              detected={ipInfo.vpn_detected}
              confidence={ipInfo.vpn_confidence}
              reason={
                ipInfo.vpn_detected
                  ? `Anomaly detected — ${Math.round(ipInfo.vpn_confidence * 100)}% confidence`
                  : "Direct connection verified"
              }
            />

            {/* Connection details */}
            <div
              style={{
                background: "#0F0F12",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 3,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <InfoRow label="IP" value={maskIp(ipInfo.ip)} />
              <InfoRow label="ISP" value={ipInfo.isp || "—"} />
              <InfoRow label="LOCATION" value={ipInfo.city && ipInfo.country ? `${ipInfo.city}, ${ipInfo.country}` : "—"} />
              <InfoRow label="TIMEZONE" value={ipInfo.timezone || "—"} />
            </div>

            {/* Active connections count */}
            <div
              style={{
                background: "#0F0F12",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 3,
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 10, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)" }}>
                ACTIVE CONNECTIONS
              </span>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#00E5FF",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {connections.filter((c) => c.state.toUpperCase() === "ESTABLISHED").length}
              </span>
            </div>

            {/* Measure speed */}
            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {speedResult !== null && (
                <div
                  style={{
                    background: "#0F0F12",
                    border: "1px solid rgba(0,229,255,0.2)",
                    borderRadius: 3,
                    padding: "8px 12px",
                    textAlign: "center",
                  }}
                >
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>
                    MEASURED SPEED
                  </span>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#00E5FF", fontFamily: "monospace" }}>
                    {speedResult.toFixed(1)}{" "}
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Mbps</span>
                  </div>
                </div>
              )}
              <LiquidGlassButton onClick={handleMeasureSpeed} disabled={measuring}>
                {measuring ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <SpinnerDots /> MEASURING…
                  </span>
                ) : (
                  "⚡ MEASURE SPEED"
                )}
              </LiquidGlassButton>
            </div>
          </div>

          {/* Zone 3 — FLOW (right 60%) */}
          <div
            style={{
              flex: 1,
              padding: "12px 16px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <ZoneLabel>FLOW</ZoneLabel>

            {/* Header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "52px 1fr 1fr 80px",
                gap: 8,
                padding: "0 8px 6px",
                fontSize: 9,
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.25)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                marginBottom: 2,
              }}
            >
              <span>PROTO</span>
              <span>LOCAL</span>
              <span>REMOTE</span>
              <span style={{ textAlign: "right" }}>STATE</span>
            </div>

            {/* Connections list */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              {connections.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(255,255,255,0.2)",
                    fontSize: 11,
                    letterSpacing: "0.1em",
                  }}
                >
                  NO ACTIVE CONNECTIONS
                </div>
              ) : (
                connections.map((conn, idx) => (
                  <ConnectionRow key={idx} conn={conn} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TitleBar({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        height: 28,
        background: "#0A0A0D",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        // @ts-expect-error – Tauri/Electron drag region
        WebkitAppRegion: "drag",
        flexShrink: 0,
      }}
    >
      {/* App name */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: "#00E5FF",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        NETPULSE
      </span>

      {/* Traffic light dots */}
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          // @ts-expect-error – Tauri/Electron no-drag region
          WebkitAppRegion: "no-drag",
        }}
      >
        <TrafficDot color="#FF4455" title="Close" onClick={onClose} />
        <TrafficDot color="#FFAA00" title="Minimize" onClick={() => {}} />
        <TrafficDot color="#00FF87" title="Maximize" onClick={() => {}} />
      </div>
    </div>
  );
}

function TrafficDot({ color, title, onClick }: { color: string; title: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 11,
        height: 11,
        borderRadius: "50%",
        background: hover ? color : `${color}88`,
        border: "none",
        cursor: "pointer",
        padding: 0,
        transition: "background 0.15s",
        boxShadow: hover ? `0 0 6px ${color}60` : "none",
      }}
    />
  );
}

function ZoneLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: "0.14em",
        color: "rgba(255,255,255,0.25)",
        padding: "6px 0 4px",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 9, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.75)",
          fontFamily: "'JetBrains Mono', monospace",
          maxWidth: "60%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ConnectionRow({ conn }: { conn: Connection }) {
  const color = stateColor(conn.state);
  const bg = stateBg(conn.state);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "52px 1fr 1fr 80px",
        gap: 8,
        padding: "4px 8px",
        borderRadius: 2,
        alignItems: "center",
        background: "transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Protocol badge */}
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.08em",
          padding: "2px 5px",
          borderRadius: 2,
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.6)",
          textAlign: "center",
          fontFamily: "'JetBrains Mono', monospace",
          display: "inline-block",
          width: "fit-content",
        }}
      >
        {conn.protocol.toUpperCase()}
      </span>

      {/* Local addr */}
      <span
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.55)",
          fontFamily: "'JetBrains Mono', monospace",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {conn.local_addr}
      </span>

      {/* Remote addr */}
      <span
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.55)",
          fontFamily: "'JetBrains Mono', monospace",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {conn.remote_addr}
      </span>

      {/* State badge */}
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.06em",
          padding: "2px 5px",
          borderRadius: 2,
          background: bg,
          color: color,
          textAlign: "center",
          fontFamily: "'JetBrains Mono', monospace",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "block",
        }}
      >
        {conn.state.toUpperCase()}
      </span>
    </div>
  );
}

function SpinnerDots() {
  const [frame, setFrame] = useState(0);
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setFrame((f) => (f + 1) % frames.length), 80);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <span style={{ fontFamily: "monospace" }}>{frames[frame]}</span>;
}
