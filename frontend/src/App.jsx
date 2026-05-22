import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  API_URL,
  getAlerts,
    deleteAlert,
    clearAlerts,
  getReadings,
  getSummary,
  postChat
} from "./api.js";
import MetricCard from "./components/MetricCard.jsx";
import ChartPanel from "./components/ChartPanel.jsx";
import PredictionPanel from "./components/PredictionPanel.jsx";
import MapPanel from "./components/MapPanel.jsx";
import AlertsPanel from "./components/AlertsPanel.jsx";
import ChatPanel from "./components/ChatPanel.jsx";
import StatusPill from "./components/StatusPill.jsx";
import VoiceTestPanel from "./components/VoiceTestPanel.jsx";
 import VoiceAssistant from "./components/VoiceAssistant.jsx";
 import AnomalyPanel from "./components/AnomalyPanel.jsx";
import "./App.css";

const LEVEL_META = {
  safe: { label: "Safe", className: "safe" },
  warning: { label: "Warning", className: "warning" },
  danger: { label: "Danger", className: "danger" }
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

// ─── SVG Icons ────────────────────────────────────────────────────────────

const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
);
const IconMoon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
);

const IconActivity = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
);
const IconMap = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
);
const IconAlertTriangle = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
);
const IconCpu = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
);
const IconMic = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
);
const IconFolder = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
);
const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.3s' }}><polyline points="15 18 9 12 15 6"></polyline></svg>
);
const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.3s' }}><polyline points="9 18 15 12 9 6"></polyline></svg>
);

const IconThermometer = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg>
);
const IconDroplet = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
);
const IconWind = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path></svg>
);
const IconFlame = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
);
const IconCloud = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>
);
const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
);

// ─── Main App ──────────────────────────────────────────────────────────────

export default function App() {
  const [summary, setSummary] = useState(null);
  const [readings, setReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState({ connected: false, lastPing: null });
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotVoiceState, setCopilotVoiceState] = useState("idle");
  const [fireAlert, setFireAlert] = useState(null);
  const [fireAlertOpen, setFireAlertOpen] = useState(false);
  const [lastFireAlertTs, setLastFireAlertTs] = useState(null);
  const [soundBlocked, setSoundBlocked] = useState(false);
    const [aiMessages, setAiMessages] = useState([
      { role: "assistant", text: "Hello Jude! I'm Kyle, your home assistant. Ask me anything about your home's safety, trends, or comfort." }
    ]);
    const [gasAlert, setGasAlert] = useState(null);
    const [gasAlertOpen, setGasAlertOpen] = useState(false);
    const [lastGasAlertTs, setLastGasAlertTs] = useState(null);
    const [smokeAlert, setSmokeAlert] = useState(null);
    const [smokeAlertOpen, setSmokeAlertOpen] = useState(false);
    const [lastSmokeAlertTs, setLastSmokeAlertTs] = useState(null);
  const alarmRef = useRef({ ctx: null, osc: null, gain: null, timer: null });

  const [currentView, setCurrentView] = useState("dashboard");
  const [alertFilter, setAlertFilter] = useState("all");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

  useEffect(() => {
    console.log("Fetching initial data...");
    let mounted = true;

    Promise.all([getSummary(), getReadings(), getAlerts()])
      .then(([summaryRes, readingsRes, alertsRes]) => {
        if (!mounted) return;
        console.log("Initial data fetched successfully:", { summaryRes, readingsRes, alertsRes });
        setSummary(summaryRes.summary);
        setReadings(readingsRes.readings.map(normalizeReading));
        setAlerts(alertsRes.alerts);
      })
      .catch((error) => {
        console.error("Error fetching initial data:", error);
        if (!mounted) return;
        setSummary(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    console.log("Attempting WebSocket connection...");
    const socket = io(API_URL, { transports: ["websocket"] });

    socket.on("connect", () => {
      console.log("WebSocket connected successfully.");
      setStatus({ connected: true, lastPing: Date.now() });
    });

    socket.on("disconnect", () => {
      console.log("WebSocket disconnected.");
      setStatus({ connected: false, lastPing: Date.now() });
    });

    socket.on("status", (payload) => {
      console.log("Received WebSocket status payload:", payload);
      if (payload?.serverTime) {
        setStatus((prev) => ({ ...prev, lastPing: payload.serverTime }));
      }
    });

    socket.on("reading", (incoming) => {
      console.log("New reading received via WebSocket:", incoming);
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
      console.log("New alert received via WebSocket:", incoming);
      setAlerts((prev) => clampReadings([incoming, ...prev]));
      if (isFireAlert(incoming)) {
        triggerFireAlert(incoming);
      }
    });

    return () => {
      console.log("Disconnecting WebSocket...");
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
    // Always send live data to backend for context-aware AI responses
    const mode = payload?.mode === "risk" ? "risk" : "guidance";
    const latestReading = readings[0] || null;
    
    // Debug logging
    console.log("📤 Sending chat context to backend:");
    console.log("  Latest reading:", latestReading);
    console.log("  Alerts:", alerts.length, "total");
    console.log("  Summary:", summary);
    
    try {
      const response = await postChat({
        ...payload,
        mode,
        context: {
          latestReading,
          alerts,
          summary
        }
      });
      return response.response;
    } finally {
      // Removed loading state updates
    }
  };

    const handleDeleteAlert = async (id) => {
      await deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    };

    const handleClearAlerts = async () => {
      await clearAlerts();
      setAlerts([]);
    };

  // Send a quick suggested prompt through the same AI pipeline as the chat input.
  const askKyleQuick = async (text) => {
    if (!text || !text.trim()) return;
    const trimmed = text.trim();
    setAiMessages((prev) => [...(prev ?? []), { role: "user", text: trimmed }]);
    try {
      const reply = await handleChat({ message: trimmed, mode: "guidance" });
      setAiMessages((prev) => [...(prev ?? []), { role: "assistant", text: reply }]);
    } catch (err) {
      setAiMessages((prev) => [
        ...(prev ?? []),
        { role: "assistant", text: "Sorry Jude, I couldn't reach the assistant just now. Please try again." }
      ]);
    }
  };

  const startAlarm = async () => {
    if (alarmRef.current.osc) return;

    try {
      let ctx = alarmRef.current.ctx;
      if (!ctx) {
        ctx = new AudioContext();
        alarmRef.current.ctx = ctx;
      }

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.value = 520;
      lfo.type = "sine";
      lfo.frequency.value = 0.6;
      lfoGain.gain.value = 260;
      gain.gain.value = 0.22;

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      lfo.start();

      alarmRef.current.osc = osc;
      alarmRef.current.lfo = lfo;
      alarmRef.current.lfoGain = lfoGain;
      alarmRef.current.gain = gain;
      alarmRef.current.timer = null;
      setSoundBlocked(false);
    } catch {
      setSoundBlocked(true);
    }
  };

  const stopAlarm = () => {
    const { osc, lfo, lfoGain, gain, timer } = alarmRef.current;
    if (timer) clearInterval(timer);
    if (gain) gain.gain.value = 0;
    if (osc) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // ignore
      }
    }
    if (lfo) {
      try {
        lfo.stop();
        lfo.disconnect();
      } catch {
        // ignore
      }
    }
    if (lfoGain) {
      try {
        lfoGain.disconnect();
      } catch {
        // ignore
      }
    }
    alarmRef.current.osc = null;
    alarmRef.current.lfo = null;
    alarmRef.current.lfoGain = null;
    alarmRef.current.gain = null;
    alarmRef.current.timer = null;
  };

  const isFireAlert = (alert) => {
    if (!alert) return false;
    if (alert?.meta?.flame === 1) return true;
    return false;
  };

    const isGasAlert = (alert) => {
      if (!alert) return false;
      return alert?.meta?.gas >= 300;
    };

    const isSmokeAlert = (alert) => {
      if (!alert) return false;
      return alert?.meta?.smoke >= 300;
    };

  const buildFireAlertFromReading = (reading) => ({
    ts: reading?.ts || Date.now(),
    level: "danger",
    title: "Flame detected",
    message: "Flame sensor triggered. Evacuate area, cut power, and investigate the source.",
    meta: {
      flame: 1,
      temperature: reading?.temperature ?? null,
      humidity: reading?.humidity ?? null,
      co2: reading?.co2 ?? null
    }
  });

  const triggerFireAlert = (alert) => {
    const ts = alert?.ts || Date.now();
    if (lastFireAlertTs && ts <= lastFireAlertTs) return;
    setLastFireAlertTs(ts);
    setFireAlert(alert);
    setFireAlertOpen(true);
    startAlarm();
  };

  useEffect(() => {
    if (latest?.flame === 1) {
      const synthetic = buildFireAlertFromReading(latest);
      triggerFireAlert(synthetic);
    }
  }, [latest]);

  useEffect(() => () => stopAlarm(), []);

    const buildGasAlertFromReading = (reading) => ({
      ts: reading?.ts || Date.now(),
      level: reading?.gas >= 600 ? "danger" : "warning",
      title: reading?.gas >= 600 ? "Dangerous Gas Level Detected" : "Elevated Gas Level",
      message: reading?.gas >= 600
        ? "Gas concentration is critically high. Ventilate immediately, avoid open flames, and evacuate if necessary."
        : "Gas levels are elevated. Increase ventilation and check for potential sources.",
      meta: {
        gas: reading?.gas ?? null,
        temperature: reading?.temperature ?? null,
        co2: reading?.co2 ?? null
      }
    });

    const triggerGasAlert = (alert) => {
      const ts = alert?.ts || Date.now();
      if (lastGasAlertTs && ts <= lastGasAlertTs) return;
      setLastGasAlertTs(ts);
      setGasAlert(alert);
      setGasAlertOpen(true);
      if (alert.level === "danger") startAlarm();
    };

    const buildSmokeAlertFromReading = (reading) => ({
      ts: reading?.ts || Date.now(),
      level: reading?.smoke >= 600 ? "danger" : "warning",
      title: reading?.smoke >= 600 ? "Dangerous Smoke Level Detected" : "Smoke Detected",
      message: reading?.smoke >= 600
        ? "Smoke concentration is critically high. Evacuate immediately and call emergency services."
        : "Smoke has been detected. Check for fire sources and ensure ventilation.",
      meta: {
        smoke: reading?.smoke ?? null,
        temperature: reading?.temperature ?? null,
        co2: reading?.co2 ?? null
      }
    });

    const triggerSmokeAlert = (alert) => {
      const ts = alert?.ts || Date.now();
      if (lastSmokeAlertTs && ts <= lastSmokeAlertTs) return;
      setLastSmokeAlertTs(ts);
      setSmokeAlert(alert);
      setSmokeAlertOpen(true);
      if (alert.level === "danger") startAlarm();
    };

    useEffect(() => {
      if (latest?.gas >= 300) {
        triggerGasAlert(buildGasAlertFromReading(latest));
      }
    }, [latest]);

    useEffect(() => {
      if (latest?.smoke >= 300) {
        triggerSmokeAlert(buildSmokeAlertFromReading(latest));
      }
    }, [latest]);

  const navItems = [
    { id: "dashboard", label: "Home Overview", icon: <IconActivity /> },
    { id: "map", label: "Room Layout", icon: <IconMap /> },
    { id: "alerts", label: "Alert History", icon: <IconAlertTriangle />, badge: activeAlerts > 0 ? activeAlerts : null },
    { id: "ai", label: "AI Assistant", icon: <IconCpu /> },
    { id: "test", label: "Voice Test", icon: <IconCpu /> },
  ];

  const viewTitles = {
    dashboard: "Home Dashboard",
    map: "Room Layout",
    alerts: "Alert History",
    ai: "AI Assistant",
    test: "Voice Test",
  };

  return (
    <div className="app">
      {/* ── SIDEBAR ── */}
      <aside className={`sidebar ${navCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <img src="/robosphere.png" alt="HomeGuard Logo" className="brand-logo" />
          </div>
          <div className="brand-text">
            <h1>HomeGuard</h1>
            <span>Monitoring System</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Main Menu</div>
          {navItems.map(item => (
            <div
              key={item.id}
              className={`nav-item ${currentView === item.id ? "active" : ""}`}
              onClick={() => setCurrentView(item.id)}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </div>
          ))}
          
          <div style={{ marginTop: "auto", marginBottom: "12px", padding: "0 10px", opacity: navCollapsed ? 0 : 1, transition: "opacity 0.2s" }}>
             <div className="panel" style={{ padding: "12px", border: "1px solid var(--border)", background: "var(--panel-strong)" }}>
                <div className="info-row">
                  <span className="label">System Status</span>
                  <StatusPill connected={status.connected} />
                </div>
                <div className="info-row">
                  <span className="label">Active Rules</span>
                  <span className="value">14 Running</span>
                </div>
             </div>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-toggle" onClick={() => setNavCollapsed(!navCollapsed)}>
            {navCollapsed ? <IconChevronRight /> : <IconChevronLeft />}
            <span className="toggle-label">Collapse Menu</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <main className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <div className="breadcrumb">
              <span className="breadcrumb-root">HomeGuard</span>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">{viewTitles[currentView]}</span>
            </div>
          </div>
          <div className="topbar-right">
            <button 
              onClick={toggleTheme} 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '4px' }}
              title="Toggle Theme"
            >
              {theme === "dark" ? <IconSun /> : <IconMoon />}
            </button>
            <div className="topbar-divider"></div>
            <span className={`pill ${hazard.className}`}>{hazard.label}</span>
            <div className="topbar-divider"></div>
            <div className="topbar-time">{formatDate(latest?.ts)} {formatTime(latest?.ts)}</div>
          </div>
        </header>

        {/* Page Content */}
        <div className="page">
          
          <div className="page-header">
            <div className="page-title">
              <h2>{viewTitles[currentView]}</h2>
              <p>Real-time home environment monitoring and safety status.</p>
            </div>
          </div>

          {currentView === "dashboard" && (
            <>
              {/* Hero status banner */}
              <section className={`hero-status hero-${hazard.className}`}>
                <div className="hero-status-left">
                  <div className="hero-status-pulse">
                    <span className="hero-pulse-ring" />
                    <span className="hero-pulse-ring" />
                    <span className="hero-pulse-core" />
                  </div>
                  <div>
                    <div className="hero-status-eyebrow">Home Safety Status</div>
                    <h2 className="hero-status-title">
                      {hazard.className === "safe" ? "All Systems Normal" :
                       hazard.className === "warning" ? "Caution Advised" :
                       "Action Required"}
                    </h2>
                    <p className="hero-status-sub">
                      {hazard.className === "safe"
                        ? "Every sensor in your home is reporting healthy values."
                        : hazard.className === "warning"
                        ? "One or more readings are trending out of normal range."
                        : "Critical thresholds exceeded — review alerts immediately."}
                    </p>
                  </div>
                </div>
                <div className="hero-status-right">
                  <div className="hero-stat">
                    <span className="hero-stat-num">{activeAlerts}</span>
                    <span className="hero-stat-label">Critical</span>
                  </div>
                  <div className="hero-stat">
                    <span className="hero-stat-num">{warningAlerts}</span>
                    <span className="hero-stat-label">Warnings</span>
                  </div>
                  <div className="hero-stat">
                    <span className="hero-stat-num">{readings.length}</span>
                    <span className="hero-stat-label">Readings</span>
                  </div>
                </div>
              </section>

              {/* Climate group */}
              <section className="dash-group">
                <div className="dash-group-head">
                  <span className="dash-group-tag">CLIMATE</span>
                  <span className="dash-group-line" />
                  <span className="dash-group-meta">Comfort &amp; air conditions</span>
                </div>
                <div className="stat-row stat-row-3">
                  <div className="stat-card">
                    <div className="stat-card-top">
                      <div className="stat-card-icon warning"><IconThermometer /></div>
                      <span className="stat-card-delta">+1.2%</span>
                    </div>
                    <div className="stat-card-value">{formatTemp(latest?.temperature)}<em>°C</em></div>
                    <div className="stat-card-label">Room Temperature</div>
                    <div className="stat-card-foot">
                      <div className="stat-bar">
                        <div
                          className="stat-bar-fill warm"
                          style={{ width: `${Math.min(100, Math.max(0, ((latest?.temperature ?? 22) / 50) * 100))}%` }}
                        />
                      </div>
                      <span className="stat-card-hint">Optimal 20–26°C</span>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-top">
                      <div className="stat-card-icon info"><IconDroplet /></div>
                      <span className="stat-card-delta">-0.4%</span>
                    </div>
                    <div className="stat-card-value">{formatTemp(latest?.humidity)}<em>%</em></div>
                    <div className="stat-card-label">Indoor Humidity</div>
                    <div className="stat-card-foot">
                      <div className="stat-bar">
                        <div
                          className="stat-bar-fill cool"
                          style={{ width: `${Math.min(100, Math.max(0, latest?.humidity ?? 0))}%` }}
                        />
                      </div>
                      <span className="stat-card-hint">Optimal 40–60%</span>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-top">
                      <div className="stat-card-icon accent"><IconWind /></div>
                      <span className="stat-card-delta">Stable</span>
                    </div>
                    <div className="stat-card-value">{formatNumber(latest?.co2)}<em>ppm</em></div>
                    <div className="stat-card-label">Air Quality (CO2)</div>
                    <div className="stat-card-foot">
                      <div className="stat-bar">
                        <div
                          className={`stat-bar-fill ${(latest?.co2 ?? 0) > 1000 ? "danger" : (latest?.co2 ?? 0) > 600 ? "warm" : "fresh"}`}
                          style={{ width: `${Math.min(100, ((latest?.co2 ?? 0) / 2000) * 100)}%` }}
                        />
                      </div>
                      <span className="stat-card-hint">Fresh &lt; 600 ppm</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Safety group */}
              <section className="dash-group">
                <div className="dash-group-head">
                  <span className="dash-group-tag danger">SAFETY</span>
                  <span className="dash-group-line" />
                  <span className="dash-group-meta">Hazard detection sensors</span>
                </div>
                <div className="stat-row stat-row-3">
                  <div className={`stat-card safety-card ${latest?.flame === 1 ? "alert" : ""}`}>
                    <div className="stat-card-top">
                      <div className={`stat-card-icon ${latest?.flame === 1 ? "danger" : "safe"}`}><IconFlame /></div>
                      <span className={`status-chip ${latest?.flame === 1 ? "danger" : "safe"}`}>
                        {latest?.flame === 1 ? "DETECTED" : "CLEAR"}
                      </span>
                    </div>
                    <div className="stat-card-value">{latest?.flame === 1 ? "ALERT" : "OK"}</div>
                    <div className="stat-card-label">Fire Detection</div>
                  </div>
                  <div className={`stat-card safety-card ${(latest?.smoke ?? 0) > 300 ? "alert" : ""}`}>
                    <div className="stat-card-top">
                      <div className={`stat-card-icon ${(latest?.smoke ?? 0) > 300 ? "danger" : "safe"}`}><IconCloud /></div>
                      <span className={`status-chip ${(latest?.smoke ?? 0) > 300 ? "danger" : "safe"}`}>
                        {(latest?.smoke ?? 0) > 300 ? "HIGH" : "NORMAL"}
                      </span>
                    </div>
                    <div className="stat-card-value">{formatNumber(latest?.smoke)}</div>
                    <div className="stat-card-label">Smoke Level</div>
                    <div className="stat-card-foot">
                      <div className="stat-bar">
                        <div
                          className={`stat-bar-fill ${(latest?.smoke ?? 0) > 300 ? "danger" : "fresh"}`}
                          style={{ width: `${Math.min(100, ((latest?.smoke ?? 0) / 500) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className={`stat-card safety-card ${(latest?.gas ?? 0) > 300 ? "alert" : ""}`}>
                    <div className="stat-card-top">
                      <div className={`stat-card-icon ${(latest?.gas ?? 0) > 300 ? "warning" : "safe"}`}><IconShield /></div>
                      <span className={`status-chip ${(latest?.gas ?? 0) > 300 ? "warning" : "safe"}`}>
                        {(latest?.gas ?? 0) > 300 ? "ELEVATED" : "NORMAL"}
                      </span>
                    </div>
                    <div className="stat-card-value">{formatNumber(latest?.gas)}</div>
                    <div className="stat-card-label">Gas Detection</div>
                    <div className="stat-card-foot">
                      <div className="stat-bar">
                        <div
                          className={`stat-bar-fill ${(latest?.gas ?? 0) > 300 ? "warm" : "fresh"}`}
                          style={{ width: `${Math.min(100, ((latest?.gas ?? 0) / 500) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <div className="two-col">
                <ChartPanel readings={readings} />
                <AlertsPanel alerts={alerts} onDelete={handleDeleteAlert} onClearAll={handleClearAlerts} />
              </div>
              <AnomalyPanel readings={readings} />
            </>
          )}

          {currentView === "map" && (
            <>
              {/* Hero banner */}
              <section className={`hero-status hero-${hazard.className}`}>
                <div className="hero-status-left">
                  <div className="hero-status-pulse">
                    <span className="hero-pulse-ring" />
                    <span className="hero-pulse-ring" />
                    <span className="hero-pulse-core" />
                  </div>
                  <div>
                    <div className="hero-status-eyebrow">Home Zone Monitor</div>
                    <h2 className="hero-status-title">
                      {hazard.className === "safe" ? "Zone Status: Secure" :
                       hazard.className === "warning" ? "Zone Status: Caution" :
                       "Zone Status: Critical"}
                    </h2>
                    <p className="hero-status-sub">
                      Live sensor positioning and hazard radius mapped to your home layout.
                    </p>
                  </div>
                </div>
                <div className="hero-status-right">
                  <div className="hero-stat">
                    <span className="hero-stat-num">{formatTemp(latest?.temperature)}°</span>
                    <span className="hero-stat-label">Temp</span>
                  </div>
                  <div className="hero-stat">
                    <span className="hero-stat-num">{formatNumber(latest?.co2)}</span>
                    <span className="hero-stat-label">CO2</span>
                  </div>
                  <div className="hero-stat">
                    <span className="hero-stat-num">{activeAlerts}</span>
                    <span className="hero-stat-label">Critical</span>
                  </div>
                </div>
              </section>

              <div className="map-grid">
                  <MapPanel map={summary?.map} latest={latest} />

                <div className="map-side-rail">
                  {/* Active sensors */}
                  <div className="panel">
                    <div className="panel-header">
                      <div>
                        <h3>Active Sensors</h3>
                        <p>Live readings by sensor</p>
                      </div>
                      <span className="section-chip">6</span>
                    </div>
                    <div className="sensor-list">
                      {[
                        { name: "Temperature", icon: <IconThermometer />, value: formatTemp(latest?.temperature), unit: "°C", level: "safe" },
                        { name: "Humidity", icon: <IconDroplet />, value: formatTemp(latest?.humidity), unit: "%", level: "safe" },
                        { name: "Air Quality", icon: <IconWind />, value: formatNumber(latest?.co2), unit: "ppm", level: (latest?.co2 ?? 0) > 1000 ? "danger" : (latest?.co2 ?? 0) > 600 ? "warning" : "safe" },
                        { name: "Fire", icon: <IconFlame />, value: latest?.flame === 1 ? "YES" : "NO", unit: "", level: latest?.flame === 1 ? "danger" : "safe" },
                        { name: "Smoke", icon: <IconCloud />, value: formatNumber(latest?.smoke), unit: "", level: (latest?.smoke ?? 0) > 300 ? "danger" : "safe" },
                        { name: "Gas", icon: <IconShield />, value: formatNumber(latest?.gas), unit: "", level: (latest?.gas ?? 0) > 300 ? "warning" : "safe" },
                      ].map((s) => (
                        <div key={s.name} className={`sensor-item sensor-${s.level}`}>
                          <div className={`sensor-item-icon ${s.level}`}>{s.icon}</div>
                          <div className="sensor-item-text">
                            <div className="sensor-item-name">{s.name}</div>
                            <div className="sensor-item-value">
                              {s.value}<em>{s.unit}</em>
                            </div>
                          </div>
                          <span className={`sensor-item-dot ${s.level}`} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Zone legend */}
                  <div className="panel">
                    <div className="panel-header">
                      <div>
                        <h3>Zone Legend</h3>
                        <p>How to read the radius</p>
                      </div>
                    </div>
                    <div className="zone-legend">
                      <div className="zone-legend-item">
                        <span className="zone-swatch safe" />
                        <div>
                          <div className="zone-legend-name">Safe Zone</div>
                            <div className="zone-legend-meta">30m radius · all sensors normal</div>
                        </div>
                      </div>
                      <div className="zone-legend-item">
                        <span className="zone-swatch warning" />
                        <div>
                          <div className="zone-legend-name">Caution Zone</div>
                          <div className="zone-legend-meta">350m radius · elevated readings</div>
                        </div>
                      </div>
                      <div className="zone-legend-item">
                        <span className="zone-swatch danger" />
                        <div>
                          <div className="zone-legend-name">Critical Zone</div>
                          <div className="zone-legend-meta">500m radius · immediate hazard</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {currentView === "alerts" && (
            <>
              {/* Stats hero */}
              <section className="alerts-hero">
                <div className="alerts-hero-card alerts-hero-total">
                  <div className="alerts-hero-num">{alerts.length}</div>
                  <div className="alerts-hero-label">Total Alerts</div>
                </div>
                <div className="alerts-hero-card alerts-hero-danger">
                  <div className="alerts-hero-num">{activeAlerts}</div>
                  <div className="alerts-hero-label">Critical</div>
                  <div className="alerts-hero-bar">
                    <div
                      className="alerts-hero-bar-fill danger"
                      style={{ width: `${alerts.length ? (activeAlerts / alerts.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="alerts-hero-card alerts-hero-warning">
                  <div className="alerts-hero-num">{warningAlerts}</div>
                  <div className="alerts-hero-label">Warnings</div>
                  <div className="alerts-hero-bar">
                    <div
                      className="alerts-hero-bar-fill warning"
                      style={{ width: `${alerts.length ? (warningAlerts / alerts.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="alerts-hero-card alerts-hero-safe">
                  <div className="alerts-hero-num">{Math.max(0, alerts.length - activeAlerts - warningAlerts)}</div>
                  <div className="alerts-hero-label">Info</div>
                  <div className="alerts-hero-bar">
                    <div
                      className="alerts-hero-bar-fill safe"
                      style={{ width: `${alerts.length ? ((alerts.length - activeAlerts - warningAlerts) / alerts.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </section>

              {/* Filter chips */}
              <section className="alerts-filter-bar">
                <span className="alerts-filter-label">FILTER</span>
                <button
                  type="button"
                  className={`alerts-filter-chip${alertFilter === "all" ? " active" : ""}`}
                  onClick={() => setAlertFilter("all")}
                >
                  <span className="ac-dot" />All
                  <span className="ac-count">{alerts.length}</span>
                </button>
                <button
                  type="button"
                  className={`alerts-filter-chip danger${alertFilter === "danger" ? " active" : ""}`}
                  onClick={() => setAlertFilter("danger")}
                >
                  <span className="ac-dot danger" />Critical
                  <span className="ac-count">{activeAlerts}</span>
                </button>
                <button
                  type="button"
                  className={`alerts-filter-chip warning${alertFilter === "warning" ? " active" : ""}`}
                  onClick={() => setAlertFilter("warning")}
                >
                  <span className="ac-dot warning" />Warning
                  <span className="ac-count">{warningAlerts}</span>
                </button>
                <button
                  type="button"
                  className={`alerts-filter-chip safe${alertFilter === "safe" ? " active" : ""}`}
                  onClick={() => setAlertFilter("safe")}
                >
                  <span className="ac-dot safe" />Info
                  <span className="ac-count">{Math.max(0, alerts.length - activeAlerts - warningAlerts)}</span>
                </button>
              </section>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Alert History</h3>
                    <p>All safety alerts and notifications</p>
                  </div>
                  <span className="section-chip">
                    {alertFilter === "all"
                      ? `${alerts.length} Total`
                      : `${alerts.filter(a => (a.level || "safe") === alertFilter).length} ${alertFilter}`}
                  </span>
                </div>
                <AlertsPanel
                  alerts={alertFilter === "all" ? alerts : alerts.filter(a => (a.level || "safe") === alertFilter)}
                  fullHeight
                  onDelete={handleDeleteAlert}
                  onClearAll={handleClearAlerts}
                />
              </div>
            </>
          )}

          {currentView === "ai" && (
            <>
              {/* Hero banner */}
              <section className="ai-hero">
                <div className="ai-hero-glyph">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 2v3M12 19v3M22 12h-3M5 12H2M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12M19.07 19.07l-2.12-2.12M7.05 7.05L4.93 4.93"/>
                  </svg>
                  <span className="ai-hero-glyph-pulse" />
                </div>
                <div className="ai-hero-text">
                  <div className="ai-hero-eyebrow">AI ASSISTANT · KYLE</div>
                  <h2 className="ai-hero-title">How can I help you today, Jude?</h2>
                  <p className="ai-hero-sub">
                    I have full context on your home — temperature, air quality, alerts, and trends. Ask anything.
                  </p>
                </div>
                <div className="ai-hero-stats">
                  <div className="ai-hero-stat">
                    <span className="ai-hero-stat-dot online" />
                    <div>
                      <div className="ai-hero-stat-num">Online</div>
                      <div className="ai-hero-stat-label">Status</div>
                    </div>
                  </div>
                  <div className="ai-hero-stat">
                    <div>
                      <div className="ai-hero-stat-num">{readings.length}</div>
                      <div className="ai-hero-stat-label">Data Points</div>
                    </div>
                  </div>
                  <div className="ai-hero-stat">
                    <div>
                      <div className="ai-hero-stat-num">{alerts.length}</div>
                      <div className="ai-hero-stat-label">Alerts</div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Quick action chips */}
              <section className="ai-quick-actions">
                <span className="ai-quick-label">SUGGESTED</span>
                <button
                  type="button"
                  className="ai-quick-chip"
                  onClick={() => askKyleQuick("What's my home's current safety status?")}
                >
                  <span className="ai-chip-dot accent" />
                  What's my home's current safety status?
                </button>
                <button
                  type="button"
                  className="ai-quick-chip"
                  onClick={() => askKyleQuick("Are there any unusual trends in my readings?")}
                >
                  <span className="ai-chip-dot info" />
                  Any unusual trends?
                </button>
                <button
                  type="button"
                  className="ai-quick-chip"
                  onClick={() => askKyleQuick("Suggest improvements to my indoor air quality.")}
                >
                  <span className="ai-chip-dot warning" />
                  Improve air quality
                </button>
              </section>

              <div className="two-col ai-grid">
                <ChatPanel
                  title="Home Assistant"
                  subtitle="Ask me about your home or anything else."
                  readings={readings}
                  alerts={alerts}
                  summary={summary}
                  onSend={handleChat}
                  fullHeight
                  messages={aiMessages}
                  onMessagesChange={setAiMessages}
                />
                <div className="ai-side-rail">
                  <PredictionPanel readings={readings} />
                  <ChartPanel readings={readings} />
                  <AnomalyPanel readings={readings} />
                </div>
              </div>
            </>
          )}

          {currentView === "test" && (
            <div className="panel test-page">
              <div className="panel-header">
                <div>
                  <h3>Voice Test</h3>
                  <p>Test the voice assistant</p>
                </div>
                <span className="section-chip">Live View</span>
              </div>
              <VoiceTestPanel />
            </div>
          )}
        </div>
      </main>

      <button
        className={`copilot-fab ${copilotOpen ? "open" : ""}`}
        onClick={() => setCopilotOpen((prev) => !prev)}
        aria-expanded={copilotOpen}
        aria-label="Toggle Home Assistant"
      >
        {copilotOpen ? <IconMic /> : <IconCpu />}
        <span>{copilotOpen ? "Listening" : "Assistant"}</span>
      </button>

      {copilotOpen && (
        <button
          className="copilot-backdrop"
          onClick={() => setCopilotOpen(false)}
          aria-label="Close Home Assistant"
        />
      )}

      <aside className={`copilot-drawer ${copilotOpen ? "open" : ""} ${copilotVoiceState}`}>
        <div className="copilot-header">
          <div className="copilot-header-title">
            <div className="copilot-header-glyph">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v3M12 19v3M22 12h-3M5 12H2M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12M19.07 19.07l-2.12-2.12M7.05 7.05L4.93 4.93"/>
              </svg>
            </div>
            <div>
              <h3>Kyle</h3>
              <p>Home assistant — tap to speak</p>
            </div>
          </div>
          <button
            className="copilot-close"
            onClick={() => setCopilotOpen(false)}
            aria-label="Close assistant"
          />
        </div>
        <div className="copilot-body">
          {copilotOpen && (
            <VoiceAssistant
              onSend={handleChat}
              readings={readings}
              alerts={alerts}
              onStateChange={setCopilotVoiceState}
            />
          )}
        </div>
      </aside>

      {fireAlertOpen && (
        <div className="alert-overlay" role="alertdialog" aria-modal="true">
          <div className="alert-modal">
            <div className="alert-modal-header">
              <span className="pill danger">Critical</span>
              <button
                className="alert-close"
                onClick={() => {
                  setFireAlertOpen(false);
                  stopAlarm();
                }}
                aria-label="Dismiss fire alert"
              >
                Dismiss
              </button>
            </div>
            <h3>{fireAlert?.title || "Flame detected"}</h3>
            <p>{fireAlert?.message || "Flame sensor triggered. Evacuate area and investigate immediately."}</p>
            {soundBlocked && (
              <div className="alert-sound-note">
                Sound is blocked by the browser. Click enable to play the alarm.
                <button className="alert-secondary" onClick={startAlarm}>Enable sound</button>
              </div>
            )}
            <div className="alert-modal-details">
              <div>
                <span className="muted">Time</span>
                <strong>{formatTime(fireAlert?.ts)}</strong>
              </div>
              <div>
                <span className="muted">CO2</span>
                <strong>{formatNumber(fireAlert?.meta?.co2)} ppm</strong>
              </div>
              <div>
                <span className="muted">Temp</span>
                <strong>{formatTemp(fireAlert?.meta?.temperature)} C</strong>
              </div>
            </div>
            <div className="alert-modal-actions">
              <button className="alert-primary" onClick={() => {
                setFireAlertOpen(false);
                stopAlarm();
              }}>
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

        {gasAlertOpen && (
          <div className="alert-overlay" role="alertdialog" aria-modal="true">
            <div className="alert-modal">
              <div className="alert-modal-header">
                <span className={`pill ${gasAlert?.level === "danger" ? "danger" : "warning"}`}>
                  {gasAlert?.level === "danger" ? "Critical" : "Warning"}
                </span>
                <button
                  className="alert-close"
                  onClick={() => { setGasAlertOpen(false); stopAlarm(); }}
                  aria-label="Dismiss gas alert"
                >
                  Dismiss
                </button>
              </div>
              <h3>{gasAlert?.title || "Gas Detected"}</h3>
              <p>{gasAlert?.message}</p>
              {soundBlocked && gasAlert?.level === "danger" && (
                <div className="alert-sound-note">
                  Sound is blocked by the browser. Click enable to play the alarm.
                  <button className="alert-secondary" onClick={startAlarm}>Enable sound</button>
                </div>
              )}
              <div className="alert-modal-details">
                <div>
                  <span className="muted">Time</span>
                  <strong>{formatTime(gasAlert?.ts)}</strong>
                </div>
                <div>
                  <span className="muted">Gas Level</span>
                  <strong>{formatNumber(gasAlert?.meta?.gas)}</strong>
                </div>
                <div>
                  <span className="muted">Temp</span>
                  <strong>{formatTemp(gasAlert?.meta?.temperature)} C</strong>
                </div>
              </div>
              <div className="alert-modal-actions">
                <button className="alert-primary" onClick={() => { setGasAlertOpen(false); stopAlarm(); }}>
                  Acknowledge
                </button>
              </div>
            </div>
          </div>
        )}

        {smokeAlertOpen && (
          <div className="alert-overlay" role="alertdialog" aria-modal="true">
            <div className="alert-modal">
              <div className="alert-modal-header">
                <span className={`pill ${smokeAlert?.level === "danger" ? "danger" : "warning"}`}>
                  {smokeAlert?.level === "danger" ? "Critical" : "Warning"}
                </span>
                <button
                  className="alert-close"
                  onClick={() => { setSmokeAlertOpen(false); stopAlarm(); }}
                  aria-label="Dismiss smoke alert"
                >
                  Dismiss
                </button>
              </div>
              <h3>{smokeAlert?.title || "Smoke Detected"}</h3>
              <p>{smokeAlert?.message}</p>
              {soundBlocked && smokeAlert?.level === "danger" && (
                <div className="alert-sound-note">
                  Sound is blocked by the browser. Click enable to play the alarm.
                  <button className="alert-secondary" onClick={startAlarm}>Enable sound</button>
                </div>
              )}
              <div className="alert-modal-details">
                <div>
                  <span className="muted">Time</span>
                  <strong>{formatTime(smokeAlert?.ts)}</strong>
                </div>
                <div>
                  <span className="muted">Smoke Level</span>
                  <strong>{formatNumber(smokeAlert?.meta?.smoke)}</strong>
                </div>
                <div>
                  <span className="muted">Temp</span>
                  <strong>{formatTemp(smokeAlert?.meta?.temperature)} C</strong>
                </div>
              </div>
              <div className="alert-modal-actions">
                <button className="alert-primary" onClick={() => { setSmokeAlertOpen(false); stopAlarm(); }}>
                  Acknowledge
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
