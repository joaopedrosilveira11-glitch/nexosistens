export function SectionCard({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`section-card ${className}`.trim()}>
      <div className="section-card-header">
        <div>
          {subtitle ? <p className="section-kicker">{subtitle}</p> : null}
          {title ? <h3>{title}</h3> : null}
        </div>
        {actions ? <div className="section-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}
