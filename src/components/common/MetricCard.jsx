export function MetricCard({ label, value, delta, tone = 'neutral' }) {
  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <small className={`metric-delta ${tone}`}>{delta}</small>
    </article>
  )
}
