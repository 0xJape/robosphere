import { useMemo, useEffect, useRef } from "react";
import { textToSpeech } from "../api.js";

// Module-level lock — prevents two TTS calls firing at the same time
let isSpeakingLock = false;

// ── Alert tones via Web Audio API ────────────────────────────────────────────
const playAlertTone = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Gas: 3 soft low pulses at 380Hz (gentle, distinct from flame's 520Hz)
    // Smoke: 3 soft higher pulses at 740Hz
    const freq = type === "gas" ? 380 : 740;
    const pulses = 3;
    const pulseLen = 0.15;
    const gap = 0.12;
    const volume = type === "gas" ? 0.3 : 0.12;
    let t = ctx.currentTime + 0.05;
    for (let i = 0; i < pulses; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.04);
      gain.gain.linearRampToValueAtTime(volume, t + pulseLen - 0.04);
      gain.gain.linearRampToValueAtTime(0, t + pulseLen);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + pulseLen);
      t += pulseLen + gap;
    }
    setTimeout(() => ctx.close(), (t - ctx.currentTime + 0.2) * 1000);
  } catch (e) { /* audio not supported */ }
};

const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// ── SVG Icons ────────────────────────────────────────────────────────────────
const IconWind = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>
);
const IconThermometer = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>
);
const IconCloud = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
);
const IconShield = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);
const IconDroplet = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
);
const IconAlertTriangle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);
const IconAlertCircle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
);
const IconInfo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
);
const IconCheckCircle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);
const IconTrendUp = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
);
const IconTrendDown = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
);
const IconMinus = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
);

// ── Linear slope ─────────────────────────────────────────────────────────────
const calcSlope = (readings, accessor) => {
  const pts = readings.map((r, i) => ({ x: i, y: accessor(r) })).filter(p => p.y !== null);
  if (pts.length < 3) return 0;
  const n = pts.length;
  const sumX = pts.reduce((s, p) => s + p.x, 0);
  const sumY = pts.reduce((s, p) => s + p.y, 0);
  const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return 0;
  return (n * sumXY - sumX * sumY) / denom;
};

// ── Anomaly detection ────────────────────────────────────────────────────────
const detectAnomalies = (recent) => {
  const anomalies = [];
  if (recent.length < 5) return anomalies;
  const sensors = [
    { key: "co2",         label: "CO2",        unit: "ppm", spikeThreshold: 150 },
    { key: "temperature", label: "Temperature", unit: "°C",  spikeThreshold: 2   },
    { key: "smoke",       label: "Smoke",       unit: "",    spikeThreshold: 80  },
    { key: "gas",         label: "Gas",         unit: "",    spikeThreshold: 80  },
  ];
  for (const sensor of sensors) {
    const vals = recent.map(r => toNum(r[sensor.key])).filter(v => v !== null);
    if (vals.length < 5) continue;
    const last = vals[vals.length - 1];
    const prev = vals.slice(-5, -1);
    const prevAvg = prev.reduce((a, b) => a + b, 0) / prev.length;
    const delta = last - prevAvg;
    if (Math.abs(delta) >= sensor.spikeThreshold) {
      const dir = delta > 0 ? "spiked up" : "dropped";
      anomalies.push({
        level: Math.abs(delta) >= sensor.spikeThreshold * 2 ? "danger" : "warning",
        sensor: sensor.label,
        message: `${sensor.label} ${dir} by ${Math.abs(delta).toFixed(1)}${sensor.unit} vs recent average (${prevAvg.toFixed(1)}${sensor.unit} → ${last.toFixed(1)}${sensor.unit})`,
         prevAvg,
         last,
      });
    }
  }
  return anomalies;
};

// ── Trend detection ──────────────────────────────────────────────────────────
const detectTrends = (recent) => {
  const trends = [];
  if (recent.length < 8) return trends;
  const checks = [
    { key: "co2",         label: "CO2",        unit: "ppm", warnAt: 2500, dangerAt: 4000, slopeWarn: 20  },
    { key: "temperature", label: "Temperature", unit: "°C",  warnAt: 35,   dangerAt: 45,   slopeWarn: 0.3 },
    { key: "smoke",       label: "Smoke",       unit: "",    warnAt: 300,  dangerAt: 600,  slopeWarn: 15  },
    { key: "gas",         label: "Gas",         unit: "",    warnAt: 300,  dangerAt: 600,  slopeWarn: 15  },
  ];
  for (const c of checks) {
    const slope = calcSlope(recent, r => toNum(r[c.key]));
    const current = toNum(recent[recent.length - 1]?.[c.key]);
    if (current === null || slope <= 0) continue;
    const projected = current + slope * 10;
    if (projected >= c.dangerAt && current < c.dangerAt) {
      trends.push({ level: "danger", sensor: c.label, message: `${c.label} is trending up (+${slope.toFixed(1)}${c.unit}/reading) — projected to hit danger (${c.dangerAt}${c.unit}) in ~${Math.ceil((c.dangerAt - current) / slope)} readings` });
    } else if (projected >= c.warnAt && current < c.warnAt) {
      trends.push({ level: "warning", sensor: c.label, message: `${c.label} is creeping up (+${slope.toFixed(1)}${c.unit}/reading) — could reach warning threshold (${c.warnAt}${c.unit}) in ~${Math.ceil((c.warnAt - current) / slope)} readings` });
    } else if (slope >= c.slopeWarn && current < c.warnAt) {
      trends.push({ level: "info", sensor: c.label, message: `${c.label} has been rising steadily (+${slope.toFixed(1)}${c.unit}/reading) over the last ${recent.length} readings — worth keeping an eye on` });
    }
  }
  return trends;
};

// ── Correlation detection ────────────────────────────────────────────────────
const detectCorrelations = (recent) => {
  const insights = [];
  if (recent.length < 10) return insights;
  const smokeVals = recent.map(r => toNum(r.smoke)).filter(v => v !== null);
  const gasVals   = recent.map(r => toNum(r.gas)).filter(v => v !== null);
  const humVals   = recent.map(r => toNum(r.humidity)).filter(v => v !== null);
  const tempVals  = recent.map(r => toNum(r.temperature)).filter(v => v !== null);
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const avgSmoke = avg(smokeVals), avgGas = avg(gasVals), avgHum = avg(humVals), avgTemp = avg(tempVals);
  const ratio = recent.length;
  const highHum   = humVals.filter(v => v > avgHum * 1.1).length;
  const highTemp  = tempVals.filter(v => v > avgTemp * 1.05).length;
  const highSmoke = smokeVals.filter(v => v > avgSmoke * 1.3).length;
  const highGas   = gasVals.filter(v => v > avgGas * 1.3).length;
  if (highHum > ratio * 0.4 && highSmoke > ratio * 0.3)
    insights.push({ level: "info", sensor: "Humidity × Smoke", message: `High humidity (>${(avgHum * 1.1).toFixed(0)}%) is co-occurring with elevated smoke in ${highSmoke}/${ratio} recent samples — possible condensation or cooking activity` });
  if (highTemp > ratio * 0.4 && highGas > ratio * 0.3)
    insights.push({ level: "info", sensor: "Temperature × Gas", message: `Elevated temperature (>${(avgTemp * 1.05).toFixed(1)}°C) is correlating with higher gas readings in ${highGas}/${ratio} recent samples — check for heat sources near gas appliances` });
  if (highTemp > ratio * 0.4 && highSmoke > ratio * 0.3)
    insights.push({ level: "warning", sensor: "Temperature × Smoke", message: `Temperature and smoke are both elevated across ${Math.max(highTemp, highSmoke)}/${ratio} recent readings — this pattern can precede fire conditions` });
  return insights;
};

// ── Level config ─────────────────────────────────────────────────────────────
const levelStyle = {
  danger:  { pill: "danger",  Icon: IconAlertCircle,   border: "var(--danger)",  color: "var(--danger)"  },
  warning: { pill: "warning", Icon: IconAlertTriangle, border: "var(--warning)", color: "var(--warning)" },
  info:    { pill: "safe",    Icon: IconInfo,           border: "var(--accent)",  color: "var(--accent)"  },
};

// ── Sensor summary ───────────────────────────────────────────────────────────
const buildSensorSummary = (recent) => {
  const sensors = [
    { key: "co2",         label: "CO2",        unit: "ppm", Icon: IconWind,        warnAt: 2500, dangerAt: 4000 },
    { key: "temperature", label: "Temp",        unit: "°C",  Icon: IconThermometer, warnAt: 35,   dangerAt: 45   },
    { key: "smoke",       label: "Smoke",       unit: "",    Icon: IconCloud,       warnAt: 300,  dangerAt: 600  },
    { key: "gas",         label: "Gas",         unit: "",    Icon: IconShield,      warnAt: 300,  dangerAt: 600  },
    { key: "humidity",    label: "Humidity",    unit: "%",   Icon: IconDroplet,     warnAt: 75,   dangerAt: 85   },
  ];
  return sensors.map(s => {
    const vals = recent.map(r => toNum(r[s.key])).filter(v => v !== null);
    const current = vals[vals.length - 1] ?? null;
    const slope = calcSlope(recent, r => toNum(r[s.key]));
    let status = "safe";
    if (current !== null) {
      if (current >= s.dangerAt) status = "danger";
      else if (current >= s.warnAt) status = "warning";
    }
    const TrendIcon = slope > 0.5 ? IconTrendUp : slope < -0.5 ? IconTrendDown : IconMinus;
    const trendColor = slope > 0.5 ? "var(--warning)" : slope < -0.5 ? "var(--accent)" : "var(--text-sub)";
    return { ...s, current, slope, status, TrendIcon, trendColor };
  });
};

// ── Component ────────────────────────────────────────────────────────────────
export default function AnomalyPanel({ readings }) {
  const spokenKeyRef = useRef(null);
  const audioRef = useRef(null);

  const { anomalies, trends, correlations, sensorSummary } = useMemo(() => {
    const recent = readings
      .filter(r => r && Number.isFinite(Number(r.ts)))
      .slice(0, 20)
      .reverse();
    return {
      anomalies:     detectAnomalies(recent),
      trends:        detectTrends(recent),
      correlations:  detectCorrelations(recent),
      sensorSummary: buildSensorSummary(recent),
    };
  }, [readings]);

  const allInsights = useMemo(() => [
    ...anomalies.map(i => ({ ...i, category: "Anomaly" })),
    ...trends.map(i => ({ ...i, category: "Trend" })),
    ...correlations.map(i => ({ ...i, category: "Correlation" })),
  ], [anomalies, trends, correlations]);

  const statusPill = allInsights.some(i => i.level === "danger") ? "danger"
    : allInsights.some(i => i.level === "warning") ? "warning" : "safe";
  const statusLabel = statusPill === "danger" ? "Anomaly Detected"
    : statusPill === "warning" ? "Trends Found" : "All Clear";

  const urgentKey = useMemo(() => {
    const urgent = anomalies.filter(i =>
      (i.level === "danger" || i.level === "warning") &&
      i.message.includes("spiked up")
    );
    return urgent.map(i => i.message).join("|");
  }, [anomalies]);

  // ── Auto-speak on spike-up anomalies ─────────────────────────────────────
  useEffect(() => {
    if (!urgentKey) return;
    if (spokenKeyRef.current === urgentKey) return;
    spokenKeyRef.current = urgentKey;

    const urgent = anomalies.filter(i =>
      (i.level === "danger" || i.level === "warning") &&
      i.message.includes("spiked up")
    );

    const pctRise = (item) => {
      if (item.prevAvg && item.prevAvg > 0) {
        const pct = ((item.last - item.prevAvg) / item.prevAvg * 100).toFixed(0);
        return ` — that's a ${pct}% rise`;
      }
      return "";
    };

    const gasItem   = urgent.find(i => i.sensor === "Gas");
    const smokeItem = urgent.find(i => i.sensor === "Smoke");
    const others    = urgent.filter(i => i.sensor !== "Gas" && i.sensor !== "Smoke");

    const merged = [...others];
    if (gasItem && smokeItem) {
      const topLevel = gasItem.level === "danger" || smokeItem.level === "danger" ? "danger" : "warning";
      const gasPct   = gasItem.prevAvg > 0 ? ` (${((gasItem.last - gasItem.prevAvg) / gasItem.prevAvg * 100).toFixed(0)}% rise)` : "";
      const smokePct = smokeItem.prevAvg > 0 ? ` (${((smokeItem.last - smokeItem.prevAvg) / smokeItem.prevAvg * 100).toFixed(0)}% rise)` : "";
      merged.push({
        level: topLevel,
        sensor: "Gas and Smoke",
        message: `Both gas and smoke have spiked up simultaneously — gas is at ${gasItem.last?.toFixed(1) ?? "elevated"}${gasPct} and smoke is at ${smokeItem.last?.toFixed(1) ?? "elevated"}${smokePct}`,
      });
    } else {
      if (gasItem)   merged.push(gasItem);
      if (smokeItem) merged.push(smokeItem);
    }

    const hasDanger = merged.some(i => i.level === "danger");
    let speech = "Heads up, Jude. ";
    speech += merged.map(i =>
      i.sensor === "Gas and Smoke" ? i.message : i.message + pctRise(i)
    ).join(". ") + ". ";
    speech += hasDanger ? "I'd recommend taking action immediately." : "Keep an eye on it.";

    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    if (isSpeakingLock) return;
    isSpeakingLock = true;

    // Play distinct tone before speaking — gas=low growl, smoke=high beep, both=both
    if (gasItem && smokeItem) { playAlertTone("gas"); playAlertTone("smoke"); }
    else if (gasItem)   playAlertTone("gas");
    else if (smokeItem) playAlertTone("smoke");

    textToSpeech(speech)
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; isSpeakingLock = false; };
        audio.play().catch(() => { isSpeakingLock = false; });
      })
      .catch(() => { isSpeakingLock = false; });
  }, [urgentKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (readings.length < 5) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div><h3>AI Anomaly Detection</h3><p className="muted">Pattern analysis across sensors</p></div>
        </div>
        <div className="empty-state" style={{ minHeight: "160px" }}>
          <div>Collecting readings to begin analysis...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>AI Anomaly Detection</h3>
          <p className="muted">Spikes · Trends · Correlations</p>
        </div>
        <span className={`pill ${statusPill}`}>{statusLabel}</span>
      </div>

      {/* ── Sensor summary grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px", marginBottom: "16px" }}>
        {sensorSummary.map(s => (
          <div key={s.key} style={{
            background: "var(--panel-strong)",
            borderRadius: "8px",
            padding: "10px 10px 8px",
            borderTop: `2px solid ${s.status === "danger" ? "var(--danger)" : s.status === "warning" ? "var(--warning)" : "var(--border)"}`,
            display: "flex", flexDirection: "column", gap: "4px",
          }}>
            <div style={{ color: s.status === "danger" ? "var(--danger)" : s.status === "warning" ? "var(--warning)" : "var(--text-sub)" }}>
              <s.Icon />
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-sub)", fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>
              {s.current !== null ? `${s.current % 1 === 0 ? s.current : s.current.toFixed(1)}${s.unit}` : "--"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11px", color: s.trendColor, fontWeight: 600 }}>
              <s.TrendIcon />
              {Math.abs(s.slope) > 0.1 ? `${s.slope > 0 ? "+" : ""}${s.slope.toFixed(1)}/rdg` : "stable"}
            </div>
          </div>
        ))}
      </div>

      {/* ── Insights or all-clear ── */}
      {allInsights.length === 0 ? (
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "12px 14px", borderRadius: "8px",
          background: "var(--panel-strong)", borderLeft: "3px solid var(--safe)",
          fontSize: "12px", color: "var(--text-sub)", lineHeight: 1.5,
        }}>
          <span style={{ color: "var(--safe)", flexShrink: 0 }}><IconCheckCircle /></span>
          No anomalies, unusual trends, or correlations detected across the last {readings.slice(0, 20).length} readings. All sensors are behaving normally.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {allInsights.map((insight, i) => {
            const s = levelStyle[insight.level] || levelStyle.info;
            return (
              <div key={i} style={{
                display: "flex", gap: "12px", alignItems: "flex-start",
                padding: "10px 12px", borderRadius: "8px",
                background: "var(--panel-strong)", borderLeft: `3px solid ${s.border}`,
              }}>
                <span style={{ color: s.color, flexShrink: 0, marginTop: "1px" }}><s.Icon /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                    <span className={`pill ${s.pill}`} style={{ fontSize: "10px", padding: "2px 7px" }}>{insight.category}</span>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>{insight.sensor}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--text-sub)", lineHeight: 1.5 }}>{insight.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
