import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  API_URL,
  getAlerts,
  getReadings,
  getSummary,
  postChat
} from "./api.js";
import MetricCard from "./components/MetricCard.jsx";
import ChartPanel from "./components/ChartPanel.jsx";
import MapPanel from "./components/MapPanel.jsx";
import AlertsPanel from "./components/AlertsPanel.jsx";
import ChatPanel from "./components/ChatPanel.jsx";
import StatusPill from "./components/StatusPill.jsx";
import "./App.css";

const LEVEL_META = {
  safe: { label: "Safe", className: "safe" },
  warning: { label: "Warning", className: "warning" },
  danger: { label: "Danger", className: "danger" }
};

const flagLabel = (flag) => {
  switch (flag) {
    case "flame":
      return "Flame detected";
    case "co2_high":
      return "CO2 is very high";
    case "co2_warn":
      return "CO2 is elevated";
    case "smoke_high":
      return "Smoke is very high";
    case "smoke_warn":
      return "Smoke is elevated";
    case "gas_high":
      return "Gas is very high";
    case "gas_warn":
      return "Gas is elevated";
    case "temp_high":
      return "Temperature is very high";
    case "temp_warn":
      return "Temperature is elevated";
    case "humidity_low_danger":
      return "Humidity is dangerously low";
    case "humidity_low_warn":
      return "Humidity is low";
    case "humidity_high_danger":
      return "Humidity is dangerously high";
    case "humidity_high_warn":
      return "Humidity is high";
    default:
      return "System stable";
  }
};

const normalizeReading = (reading) => {
  if (!reading) return null;
  let flags = reading.hazard_flags;
  if (typeof flags === "string") {
    try {
      flags = JSON.parse(flags);
    } catch {
      flags = [];
    }
  }
  return { ...reading, hazard_flags: flags };
};

const formatNumber = (value) =>
  Number.isFinite(value) ? value.toLocaleString() : "--";

const formatTemp = (value) =>
  Number.isFinite(value) ? `${value.toFixed(1)}` : "--";

const formatTime = (ts) => {
  if (!ts) return "--";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(ts));
};

const formatDate = (ts) => {
  if (!ts) return "--";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit"
  }).format(new Date(ts));
};

const clampReadings = (list, max = 400) => list.slice(0, max);

export default function App() {
  const [summary, setSummary] = useState(null);
  const [readings, setReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState({ connected: false, lastPing: null });
  const [chatLoading, setChatLoading] = useState({ guidance: false, risk: false });

  useEffect(() => {
    let mounted = true;

    Promise.all([getSummary(), getReadings(), getAlerts()])
      .then(([summaryRes, readingsRes, alertsRes]) => {
        if (!mounted) return;
        setSummary(summaryRes.summary);
        setReadings(readingsRes.readings.map(normalizeReading));
        setAlerts(alertsRes.alerts);
      })
      .catch(() => {
        if (!mounted) return;
        setSummary(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const socket = io(API_URL, { transports: ["websocket"] });

    socket.on("connect", () => {
      setStatus({ connected: true, lastPing: Date.now() });
    });

    socket.on("disconnect", () => {
      setStatus({ connected: false, lastPing: Date.now() });
    });

    socket.on("status", (payload) => {
      if (payload?.serverTime) {
        setStatus((prev) => ({ ...prev, lastPing: payload.serverTime }));
      }
    });

    socket.on("reading", (incoming) => {
      const normalized = normalizeReading(incoming);
      setReadings((prev) => clampReadings([normalized, ...prev]));
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              lastReading: normalized,
              lastUpdated: normalized.ts
            }
          : prev
      );
    });

    socket.on("alert", (incoming) => {
      setAlerts((prev) => clampReadings([incoming, ...prev]));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const latest = useMemo(() => {
    return readings[0] || normalizeReading(summary?.lastReading) || null;
  }, [readings, summary]);

  const hazard = LEVEL_META[latest?.hazard_level || "safe"] || LEVEL_META.safe;
  const activeAlerts = alerts.filter((alert) => alert.level === "danger").length;
  const warningAlerts = alerts.filter((alert) => alert.level === "warning").length;

  const handleChat = async (payload) => {
    const mode = payload?.mode === "risk" ? "risk" : "guidance";
    setChatLoading((prev) => ({ ...prev, [mode]: true }));
    try {
      const response = await postChat(payload);
      return response.response;
    } finally {
      setChatLoading((prev) => ({ ...prev, [mode]: false }));
    }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"></div>
          <div>
            <h1>RoboSphere</h1>
            <p>Realtime safety and robotics operations</p>
          </div>
        </div>

        <div className="sidebar-card">
          <div className="sidebar-card-title">
            <span>System state</span>
            <StatusPill connected={status.connected} />
          </div>
          <div className="sidebar-row">
            <span className="muted">Last update</span>
            <strong>{formatTime(latest?.ts)}</strong>
          </div>
          <div className="sidebar-row">
            <span className="muted">Hazard level</span>
            <strong className={`pill ${hazard.className}`}>{hazard.label}</strong>
          </div>
        </div>

        <div className="sidebar-card">
          <div className="sidebar-card-title">
            <span>Totals</span>
          </div>
          <div className="sidebar-row">
            <span className="muted">Readings</span>
            <strong>{summary?.totalReadings ?? 0}</strong>
          </div>
          <div className="sidebar-row">
            <span className="muted">Alerts</span>
            <strong>{summary?.totalAlerts ?? 0}</strong>
          </div>
        </div>

        <div className="sidebar-card">
          <div className="sidebar-card-title">
            <span>Shift notes</span>
          </div>
          <p className="muted">
            Keep ventilation on. Review alert history before starting new builds.
            Use the chatbot for fast diagnostics and guidance.
          </p>
        </div>
      </aside>

      <main className="main">
        <header className="hero panel">
          <div className="hero-copy">
            <div className="eyebrow">RoboSphere command center</div>
            <h2>Live environment overview</h2>
            <p className="muted">
              Monitor sensor readings, triage hazards, and move directly into either safety analysis or robotics guidance.
            </p>
            <div className="hero-tags">
              <span className="hero-tag active">Live telemetry</span>
              <span className="hero-tag">{summary?.totalReadings ?? 0} readings stored</span>
              <span className="hero-tag warning">{warningAlerts} warnings</span>
              <span className="hero-tag danger">{activeAlerts} critical alerts</span>
            </div>
          </div>

          <div className="hero-meta">
            <div className="hero-meta-item">
              <span className="muted">Snapshot</span>
              <strong>{formatDate(latest?.ts)} {formatTime(latest?.ts)}</strong>
            </div>
            <div className="hero-meta-item">
              <span className="muted">Current state</span>
              <strong className={`pill ${hazard.className}`}>{hazard.label}</strong>
            </div>
          </div>
        </header>

        <section className="metrics">
          <MetricCard label="CO2" value={formatNumber(latest?.co2)} unit="ppm" level={hazard.className} />
          <MetricCard label="Smoke" value={formatNumber(latest?.smoke)} unit="adc" />
          <MetricCard label="Gas" value={formatNumber(latest?.gas)} unit="adc" />
          <MetricCard label="Temperature" value={formatTemp(latest?.temperature)} unit="C" />
          <MetricCard label="Humidity" value={formatTemp(latest?.humidity)} unit="%" />
          <MetricCard label="Flame" value={latest?.flame === 1 ? "Detected" : "Clear"} unit="" />
        </section>

        <section className="grid">
          <div className="section-stack">
            <div className="section-heading">
              <div>
                <h3>Live trends</h3>
                <p className="muted">Sensor movement over the latest readings</p>
              </div>
              <span className="section-chip">60 sample window</span>
            </div>
            <ChartPanel readings={readings} />
          </div>
          <div className="section-stack">
            <div className="section-heading">
              <div>
                <h3>Area map</h3>
                <p className="muted">Facility view and current placement</p>
              </div>
              <span className="section-chip">Satellite layer</span>
            </div>
            <MapPanel map={summary?.map} />
          </div>
        </section>
      </main>

      <aside className="rightbar">
        <AlertsPanel alerts={alerts} />
        <div className="ai-stack">
          <ChatPanel
            title="AI Risk Analysis"
            subtitle="Threat assessment and safety guidance"
            seedMessage="Share a concern or ask for a risk assessment of the environment."
            mode="risk"
            variant="analysis"
            placeholder="Ask for a risk analysis of the latest readings"
            onSend={handleChat}
            loading={chatLoading.risk}
          />
          <ChatPanel
            title="AI Suggestions"
            subtitle="Robotics ideas, materials, and steps"
            seedMessage="Tell me what you want to build, and I will suggest a plan and materials."
            mode="guidance"
            variant="guidance"
            placeholder="Ask for a robotics project idea or steps"
            onSend={handleChat}
            loading={chatLoading.guidance}
          />
        </div>
      </aside>
    </div>
  );
}
