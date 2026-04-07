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

export default function AlertsPanel({ alerts }) {
  const list = alerts || [];

  return (
    <div className="panel alerts-panel">
      <div className="panel-header">
        <div>
          <h3>Incident stream</h3>
          <p className="muted">Latest incidents and hazard messages</p>
        </div>
        <span className="section-chip">{list.length} total</span>
      </div>
      <div className="alerts-list">
        {list.length === 0 ? (
          <div className="empty">No alerts yet.</div>
        ) : (
          list.slice(0, 8).map((alert) => (
            <div key={alert.id || alert.ts} className={`alert-item ${alert.level}`}>
              <div className="alert-item-top">
                <strong>{alert.title}</strong>
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
    </div>
  );
}
