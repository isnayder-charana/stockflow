export type KpiTone = 'default' | 'warning' | 'danger' | 'success'

export interface Kpi {
  label: string
  /** null mientras carga. */
  value: number | string | null
  tone?: KpiTone
}

/** Fila de tarjetas con los indicadores de la pantalla. */
export default function KpiCards({ items }: { items: Kpi[] }) {
  return (
    <div className="kpi-grid">
      {items.map((kpi) => (
        <div key={kpi.label} className="kpi-card">
          <div className="kpi-label">{kpi.label}</div>
          <div className={`kpi-value kpi-${kpi.tone ?? 'default'}`}>{kpi.value ?? '…'}</div>
        </div>
      ))}
    </div>
  )
}
