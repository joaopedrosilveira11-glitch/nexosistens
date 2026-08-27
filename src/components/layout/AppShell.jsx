export default function AppShell({ title, subtitle, actions, children }) {
  return (
    <section className="app-shell">
      <header className="app-shell-header">
        <div>
          {subtitle ? <p className="section-kicker">{subtitle}</p> : null}
          {title ? <h2>{title}</h2> : null}
        </div>
        {actions ? <div className="section-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  )
}
