export type BadgeTone = 'ok' | 'warning' | 'danger' | 'muted' | 'in' | 'out'

/** Etiqueta de estado de una fila (OK, Bajo mínimo, Agotado, Entrada…). */
export default function StatusBadge({ tone, children }: { tone: BadgeTone; children: string }) {
  return <span className={`status-badge status-${tone}`}>{children}</span>
}
