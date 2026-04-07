export default function MetricCard({ label, value, unit, level }) {
  return (
    <div className={`metric-card ${level || ""}`.trim()}>
      <span className="metric-label">{label}</span>
      <div className="metric-value">
        <span>{value}</span>
        {unit ? <em>{unit}</em> : null}
      </div>
    </div>
  );
}
