import { useState } from "react";

const formatTime = (ts) => {
  if (!ts) return "--";
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });
};

const levelLabel = (level) => {
  if (level === "danger") return "Critical";
  if (level === "warning") return "Warning";
  return "Info";
};

// Local icons for alerts
const IconAlertFlame = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
);
const IconAlertThermometer = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg>
);
const IconAlertCloud = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>
);
const IconAlertInfo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
);

const getAlertIcon = (title, message, level) => {
  const t = (title + " " + message).toLowerCase();
  let Icon = IconAlertInfo;
  
  if (t.includes("flame") || t.includes("fire")) Icon = IconAlertFlame;
  else if (t.includes("temp") || t.includes("heat")) Icon = IconAlertThermometer;
  else if (t.includes("smoke") || t.includes("gas") || t.includes("co2")) Icon = IconAlertCloud;
  else if (level === "danger") Icon = IconAlertFlame;
  
  return <Icon />;
};

export default function AlertsPanel({ alerts, fullHeight }) {
  const [filter, setFilter] = useState("all");
  
  const list = alerts || [];
  const filteredList = list.filter(a => filter === "all" || a.level === filter);
  const limit = fullHeight ? filteredList.length : 8;

  const content = (
    <div className="alerts-list" style={{ maxHeight: fullHeight ? '100%' : '420px', flex: fullHeight ? 1 : 'unset' }}>
      {filteredList.length === 0 ? (
        <div className="empty-state">
           <div className="empty-state-icon">✓</div>
           No incidents match this filter.
        </div>
      ) : (
        filteredList.slice(0, limit).map((alert) => (
          <div key={alert.id || alert.ts} className={`alert-item ${alert.level}`} style={{ position: 'relative' }}>
            <div className="alert-item-top" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                color: alert.level === 'danger' ? 'var(--danger)' : (alert.level === 'warning' ? 'var(--warning)' : 'var(--info)'),
                display: 'flex', 
                alignItems: 'center'
              }}>
                {getAlertIcon(alert.title, alert.message, alert.level)}
              </div>
              <strong style={{ flex: 1 }}>{alert.title}</strong>
              <span className={`pill ${alert.level}`}>{levelLabel(alert.level)}</span>
            </div>
            <div>
              <p>{alert.message}</p>
            </div>
            <div className="alert-meta">
              <span>{formatTime(alert.ts)}</span>
              <span>{alert.level === "danger" ? "Immediate review" : "Monitor"}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );

  if (fullHeight) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`filter-btn ${filter === 'danger' ? 'active' : ''}`} onClick={() => setFilter('danger')}>Critical</button>
          <button className={`filter-btn ${filter === 'warning' ? 'active' : ''}`} onClick={() => setFilter('warning')}>Warnings</button>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="panel alerts-panel">
      <div className="panel-header">
        <div>
          <h3>Incident stream</h3>
          <p className="muted">Latest incidents and hazard messages</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`filter-btn ${filter === 'danger' ? 'active' : ''}`} onClick={() => setFilter('danger')}>Critical</button>
        </div>
      </div>
      {content}
    </div>
  );
}
