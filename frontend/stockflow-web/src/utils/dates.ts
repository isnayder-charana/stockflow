/** Fecha local en formato yyyy-MM-dd, para los inputs de tipo date. */
export function toInputDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Inicio del día local de una fecha yyyy-MM-dd, más `addDays`, en ISO (UTC). */
export function startOfDayIso(value: string, addDays = 0) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d + addDays).toISOString()
}
