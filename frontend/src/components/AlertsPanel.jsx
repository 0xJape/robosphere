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
          <h3>Alerts</h3>
          <p className="muted">Latest incidents</p>
        </div>
      </div>
      <div className="alerts-list">
        {list.length === 0 ? (
          <div className="empty">No alerts yet.</div>
        ) : (
          list.slice(0, 8).map((alert) => (
            <div key={alert.id || alert.ts} className={`alert-item ${alert.level}`}>
              <div>
                <strong>{alert.title}</strong>
                <p>{alert.message}</p>
              </div>
              <div className="alert-meta">
                <span>{levelLabel(alert.level)}</span>
                <span>{formatTime(alert.ts)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
