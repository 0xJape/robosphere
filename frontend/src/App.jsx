import { useEffect, useMemo, useRef, useState } from "react";
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
import PredictionPanel from "./components/PredictionPanel.jsx";
import MapPanel from "./components/MapPanel.jsx";
import AlertsPanel from "./components/AlertsPanel.jsx";
import ChatPanel from "./components/ChatPanel.jsx";
import StatusPill from "./components/StatusPill.jsx";
import ArchivesPanel from "./components/ArchivesPanel.jsx";
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
  const [chatLoading, setChatLoading] = useState({ guidance: false, risk: false });
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [fireAlert, setFireAlert] = useState(null);
  const [fireAlertOpen, setFireAlertOpen] = useState(false);
  const [lastFireAlertTs, setLastFireAlertTs] = useState(null);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const alarmRef = useRef({ ctx: null, osc: null, gain: null, timer: null });

  const [currentView, setCurrentView] = useState("dashboard");
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
      if (isFireAlert(incoming)) {
        triggerFireAlert(incoming);
      }
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

  const navItems = [
    { id: "dashboard", label: "Overview", icon: <IconActivity /> },
    { id: "map", label: "Facility Map", icon: <IconMap /> },
    { id: "archives", label: "Archives", icon: <IconFolder /> },
    { id: "alerts", label: "Incident Stream", icon: <IconAlertTriangle />, badge: activeAlerts > 0 ? activeAlerts : null },
    { id: "ai", label: "AI & Guidance", icon: <IconCpu /> },
  ];

  const viewTitles = {
    dashboard: "Dashboard Overview",
    map: "Facility Map",
    archives: "Archives",
    alerts: "Incident Stream",
    ai: "AI & Guidance",
  };

  return (
    <div className="app">
      {/* ── SIDEBAR ── */}
      <aside className={`sidebar ${navCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <img src="/robosphere.png" alt="RoboSphere Logo" className="brand-logo" />
          </div>
          <div className="brand-text">
            <h1>RoboSphere</h1>
            <span>Command Center</span>
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
              <span className="breadcrumb-root">RoboSphere</span>
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
              <p>Current telemetry and system status.</p>
            </div>
          </div>

          {currentView === "dashboard" && (
            <>
              <section className="stat-row">
                <div className="stat-card">
                   <div className="stat-card-top">
                      <div className="stat-card-icon warning"><IconThermometer /></div>
                      <span className="stat-card-delta">+1.2%</span>
                   </div>
                   <div className="stat-card-value">{formatTemp(latest?.temperature)}<em>°C</em></div>
                   <div className="stat-card-label">Core Temperature</div>
                </div>
                <div className="stat-card">
                   <div className="stat-card-top">
                      <div className="stat-card-icon info"><IconDroplet /></div>
                      <span className="stat-card-delta">-0.4%</span>
                   </div>
                   <div className="stat-card-value">{formatTemp(latest?.humidity)}<em>%</em></div>
                   <div className="stat-card-label">Humidity Level</div>
                </div>
                 <div className="stat-card">
                   <div className="stat-card-top">
                      <div className="stat-card-icon accent"><IconWind /></div>
                      <span className="stat-card-delta">Stable</span>
                   </div>
                   <div className="stat-card-value">{formatNumber(latest?.co2)}<em>ppm</em></div>
                   <div className="stat-card-label">CO2 Concentration</div>
                </div>
                 <div className="stat-card">
                   <div className="stat-card-top">
                      <div className={`stat-card-icon ${latest?.flame === 1 ? 'danger' : 'safe'}`}><IconFlame /></div>
                   </div>
                   <div className="stat-card-value">{latest?.flame === 1 ? "ALERT" : "CLEAR"}</div>
                   <div className="stat-card-label">Flame Sensor</div>
                </div>
                <div className="stat-card">
                   <div className="stat-card-top">
                      <div className={`stat-card-icon ${latest?.smoke > 0.5 ? 'danger' : 'safe'}`}><IconCloud /></div>
                   </div>
                   <div className="stat-card-value">{formatNumber(latest?.smoke)}<em>%</em></div>
                   <div className="stat-card-label">Smoke Sensor</div>
                </div>
                 <div className="stat-card">
                   <div className="stat-card-top">
                      <div className={`stat-card-icon ${latest?.gas > 1000 ? 'warning' : 'safe'}`}><IconShield /></div>
                   </div>
                   <div className="stat-card-value">{formatNumber(latest?.gas)}<em>ppm</em></div>
                   <div className="stat-card-label">Gas Sensor</div>
                </div>
              </section>

              <div className="two-col">
                <ChartPanel readings={readings} />
                <AlertsPanel alerts={alerts} />
              </div>
            </>
          )}

          {currentView === "map" && (
            <div className="panel map-page">
              <div className="panel-header">
                <div>
                  <h3>Facility Deployment</h3>
                  <p>Realtime sensor locations mapping</p>
                </div>
                <span className="section-chip">Mapbox Layer</span>
              </div>
              <MapPanel map={summary?.map} latest={latest} />
            </div>
          )}

          {currentView === "alerts" && (
            <div className="panel" style={{ flex: 1, minHeight: '500px' }}>
              <div className="panel-header">
                <div>
                  <h3>Global Incident Stream</h3>
                  <p>Historical and active rule violations.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <span className="section-chip">Critical ({activeAlerts})</span>
                    <span className="section-chip">Warnings ({warningAlerts})</span>
                </div>
              </div>
              <AlertsPanel alerts={alerts} fullHeight />
            </div>
          )}

          {currentView === "archives" && (
            <div className="view-section animate-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div className="section-header">
                <div>
                  <h2 className="section-title">Terminal Archives</h2>
                  <p className="section-subtitle" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>Secure storage and document management</p>
                </div>
              </div>
              <ArchivesPanel />
            </div>
          )}

          {currentView === "ai" && (
             <div className="two-col ai-grid">
                <ChatPanel
                  title="Risk Assessment AI"
                  subtitle="Safety and anomaly pattern analysis"
                  mode="risk"
                  variant="analysis"
                  onSend={handleChat}
                  loading={chatLoading.risk}
                  fullHeight
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <PredictionPanel readings={readings} />
                  <ChartPanel readings={readings} />
                </div>
             </div>
          )}

        </div>
      </main>

      <button
        className={`copilot-fab ${copilotOpen ? "open" : ""}`}
        onClick={() => setCopilotOpen((prev) => !prev)}
        aria-expanded={copilotOpen}
        aria-label="Toggle Robotics Copilot"
      >
        <IconCpu />
        <span>Copilot</span>
      </button>

      {copilotOpen && (
        <button
          className="copilot-backdrop"
          onClick={() => setCopilotOpen(false)}
          aria-label="Close Robotics Copilot"
        />
      )}

      <aside className={`copilot-drawer ${copilotOpen ? "open" : ""}`}>
        <div className="copilot-header">
          <div>
            <h3>Robotics Copilot</h3>
            <p className="muted">Suggestions, materials, and build steps</p>
          </div>
          <button className="copilot-close" onClick={() => setCopilotOpen(false)}>
            Close
          </button>
        </div>
        <div className="copilot-body">
          <ChatPanel
            title=""
            subtitle=""
            seedMessage="Tell me what you want to build, and I will suggest a plan and materials."
            mode="guidance"
            variant="guidance"
            onSend={handleChat}
            loading={chatLoading.guidance}
            placeholder="Ask for a robotics project idea or steps"
          />
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
            <div className="evacuation-map" style={{ marginTop: '16px', marginBottom: '16px', textAlign: 'center' }}>
              <img 
                src="/evacarea.png" 
                alt="Evacuation Area Map" 
                style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)' }} 
              />
            </div>
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
    </div>
  );
}
