import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SpeedGauge } from "./components/ui/SpeedGauge";
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
  if (ip.includes(":")) {
    return ip.slice(0, 8) + "…";
  }
  return ip;
}

function getPrimaryInterface(interfaces: NetworkInterface[]): NetworkInterface {
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

function countryToFlag(code: string): string {
  if (!code || code.length < 2) return "";
  const upper = code.toUpperCase().slice(0, 2);
  try {
    return String.fromCodePoint(
      ...upper.split("").map((c) => 0x1f1e0 + c.charCodeAt(0) - 65)
    );
  } catch {
    return "";
  }
}

function formatSessionBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
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
  const prevBytesRef = useRef<{ rx: number; tx: number; t: number }>({ rx: 0, tx: 0, t: 0 });
  const [rxHistory, setRxHistory] = useState<number[]>(Array(60).fill(0));

  // Session bytes received
  const [sessionBytes, setSessionBytes] = useState(0);

  // Active interface name for bottom bar
  const [interfaceName, setInterfaceName] = useState("—");

  // IP / VPN
  const [ipInfo, setIpInfo] = useState<IpInfo>(PLACEHOLDER_IP);

  // Connections
  const [connections, setConnections] = useState<Connection[]>(PLACEHOLDER_CONNECTIONS);

  // Speed test
  const [speedResult, setSpeedResult] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState(false);

  interface ProcessNetStat {
    pid: number;
    name: string;
    rx_bytes_per_sec: number;
    tx_bytes_per_sec: number;
    connections: number;
    icon_path: string | null;
  }
  const [processes, setProcesses] = useState<ProcessNetStat[]>([]);

  // ── Fetch network stats every 500ms ────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    const result = await safeInvoke<NetworkInterface[]>("get_network_stats");
    const ifaces = result ?? PLACEHOLDER_INTERFACES;
    const primary = getPrimaryInterface(ifaces);

    setInterfaceName(primary.name);

    // Compute real-time speed from byte deltas
    const now = Date.now();
    const prev = prevBytesRef.current;
    const elapsed = prev.t > 0 ? (now - prev.t) / 1000 : 0;

    let rxMbps = 0;
    let txMbps = 0;

    if (elapsed > 0.1 && prev.t > 0) {
      const rxDelta = Math.max(0, primary.bytes_received - prev.rx);
      const txDelta = Math.max(0, primary.bytes_transmitted - prev.tx);
      rxMbps = parseFloat(((rxDelta * 8) / (elapsed * 1_000_000)).toFixed(2));
      txMbps = parseFloat(((txDelta * 8) / (elapsed * 1_000_000)).toFixed(2));
      setSessionBytes((sb) => sb + rxDelta);
    }

    prevBytesRef.current = { rx: primary.bytes_received, tx: primary.bytes_transmitted, t: now };

    setRxSpeed(rxMbps);
    setTxSpeed(txMbps);
    setRxHistory((prev) => {
      const next = [...prev.slice(-59), rxMbps];
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

  // ── Process network monitor ──────────────────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      const procs = await safeInvoke<ProcessNetStat[]>("get_process_network_stats", {});
      if (procs && procs.length > 0) setProcesses(procs.slice(0, 12));
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, []);

  // ── Title bar controls ────────────────────────────────────────────────────
  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch {}
  };
  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch {}
  };
  const handleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const isMax = await win.isMaximized();
      if (isMax) await win.unmaximize();
      else await win.maximize();
    } catch {}
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const maxProcessConnections = Math.max(...processes.map((p) => p.connections), 1);
  const vpnDetected = ipInfo.vpn_detected;
  const locationStr =
    ipInfo.city && ipInfo.country !== "—"
      ? `${ipInfo.city} ${countryToFlag(ipInfo.country)}`
      : ipInfo.city || "—";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "radial-gradient(ellipse at 30% 40%, #0D1117 0%, #080809 100%)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        color: "rgba(255,255,255,0.92)",
        userSelect: "none",
      }}
    >
      {/* ── Custom Title Bar ─────────────────────────────────────────────── */}
      <TitleBar onClose={handleClose} onMinimize={handleMinimize} onMaximize={handleMaximize} />

      {/* ── Main Area (flex row) ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "row", overflow: "hidden", minHeight: 0 }}>

        {/* ── LEFT PANEL (380px) ─────────────────────────────────────────── */}
        <div
          style={{
            width: 380,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid rgba(255,255,255,0.07)",
            overflow: "hidden",
          }}
        >
          {/* Speed gauges section — 220px */}
          <div
            style={{
              height: 220,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              padding: "10px 12px 8px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {/* Two gauges side by side */}
            <div style={{ display: "flex", gap: 0, justifyContent: "center", alignItems: "center", flex: 1, minHeight: 0 }}>
              <SpeedGauge value={rxSpeed} max={1000} label="Download" color="#00E5FF" size={160} />
              <SpeedGauge value={txSpeed} max={1000} label="Upload" color="#00FF87" size={160} />
            </div>
            {/* Network graph */}
            <div style={{ flexShrink: 0 }}>
              <NetworkGraph data={rxHistory} color="#00E5FF" height={90} />
            </div>
          </div>

          {/* VPN + Connection info — remaining height */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "10px 12px",
              gap: 8,
              overflow: "hidden",
            }}
          >
            {/* VPN Card */}
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${vpnDetected ? "rgba(251,191,36,0.25)" : "rgba(0,255,135,0.2)"}`,
                borderRadius: 8,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {/* Status text */}
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: vpnDetected ? "#FBB724" : "#00FF87",
                    letterSpacing: "0.05em",
                  }}
                >
                  {vpnDetected ? "⚠ VPN ACTIVE" : "✓ DIRECT"}
                </span>
                {/* ISP name */}
                <span
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.5)",
                    maxWidth: 140,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textAlign: "right",
                  }}
                >
                  {ipInfo.isp || "—"}
                </span>
              </div>
              {/* Location row */}
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em" }}>
                {locationStr}
              </div>
            </div>

            {/* 3 metric cards in a row */}
            <div style={{ display: "flex", gap: 6 }}>
              <MetricCard label="PING" value="—" color="#00E5FF" />
              <MetricCard label="CONNS" value={String(connections.length)} color="#00E5FF" />
              <MetricCard label="SESSION" value={formatSessionBytes(sessionBytes)} color="#00FF87" />
            </div>

            {/* IP display */}
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: "8px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 9, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)" }}>IP</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>
                {maskIp(ipInfo.ip)}
              </span>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL (fills remaining ~520px) ─────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Process Monitor — top ~280px */}
          <div
            style={{
              height: 280,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              padding: "10px 14px 8px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.28)",
                marginBottom: 8,
                flexShrink: 0,
              }}
            >
              NETWORK ACTIVITY
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, overflow: "hidden" }}>
              {processes.length === 0 ? (
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
                  NO PROCESS DATA
                </div>
              ) : (
                processes.slice(0, 8).map((p) => (
                  <div
                    key={p.pid}
                    style={{
                      height: 30,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "0 4px",
                      borderRadius: 4,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    {/* App name */}
                    <span
                      style={{
                        width: 180,
                        flexShrink: 0,
                        fontSize: 11,
                        color: "rgba(255,255,255,0.75)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.name}
                    </span>
                    {/* Relative bar */}
                    <div
                      style={{
                        flex: 1,
                        height: 4,
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.round((p.connections / maxProcessConnections) * 100)}%`,
                          background: "rgba(0,229,255,0.45)",
                          borderRadius: 2,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                    {/* Connection count pill */}
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#00E5FF",
                        background: "rgba(0,229,255,0.1)",
                        border: "1px solid rgba(0,229,255,0.2)",
                        borderRadius: 4,
                        padding: "1px 6px",
                        minWidth: 28,
                        textAlign: "center",
                      }}
                    >
                      {p.connections}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Connection table — bottom ~280px */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "10px 14px 8px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.28)",
                marginBottom: 8,
                flexShrink: 0,
              }}
            >
              ACTIVE CONNECTIONS
            </div>
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
                connections.slice(0, 15).map((conn, idx) => {
                  const color = stateColor(conn.state);
                  const bg = stateBg(conn.state);
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "4px 6px",
                        borderRadius: 4,
                        gap: 8,
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      {/* Remote address */}
                      <span
                        style={{
                          flex: 1,
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
                          flexShrink: 0,
                          fontSize: 9,
                          fontWeight: 600,
                          letterSpacing: "0.05em",
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: bg,
                          color: color,
                          fontFamily: "'JetBrains Mono', monospace",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {conn.state.toUpperCase()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Bar (28px, full width) ────────────────────────────────── */}
      <div
        style={{
          height: 28,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(8,8,9,0.6)",
          gap: 12,
        }}
      >
        {/* Left: interface name */}
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.08em",
            minWidth: 60,
          }}
        >
          {interfaceName}
        </span>

        {/* Center: speed test button */}
        <LiquidGlassButton onClick={handleMeasureSpeed} disabled={measuring}>
          {measuring ? (
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <SpinnerDots /> MEASURING…
            </span>
          ) : (
            "⚡ MEASURE SPEED"
          )}
        </LiquidGlassButton>

        {/* Right: speed result */}
        <div style={{ minWidth: 100, textAlign: "right" }}>
          {speedResult !== null ? (
            <span
              style={{
                fontSize: 11,
                color: "#00E5FF",
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
              }}
            >
              ↓ {speedResult.toFixed(1)} Mbps
            </span>
          ) : (
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)" }}>—</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TitleBar({
  onClose,
  onMinimize,
  onMaximize,
}: {
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}) {
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

      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          // @ts-expect-error – Tauri/Electron no-drag region
          WebkitAppRegion: "no-drag",
        }}
      >
        <TrafficDot color="#FF5F56" title="Close" onClick={onClose} />
        <TrafficDot color="#FFBD2E" title="Minimize" onClick={onMinimize} />
        <TrafficDot color="#27C93F" title="Maximize" onClick={onMaximize} />
      </div>
    </div>
  );
}

function TrafficDot({
  color,
  title,
  onClick,
}: {
  color: string;
  title: string;
  onClick: () => void;
}) {
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

function MetricCard({
  label,
  value,
  color = "#00E5FF",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      <span
        style={{
          fontSize: 8,
          letterSpacing: "0.12em",
          color: "rgba(255,255,255,0.3)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          color,
          fontFamily: "'JetBrains Mono', monospace",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
          textAlign: "center",
        }}
      >
        {value}
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
