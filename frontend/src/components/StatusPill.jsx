export default function StatusPill({ connected }) {
  return (
    <span className={`status-pill ${connected ? "online" : "offline"}`}>
      {connected ? "Online" : "Offline"}
    </span>
  );
}
