import { describe, expect, it } from 'vitest'
import { startOfDayIso, toInputDate } from './dates.ts'

describe('toInputDate', () => {
  it('formatea la fecha local como yyyy-MM-dd con ceros', () => {
    expect(toInputDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('startOfDayIso', () => {
  it('devuelve la medianoche local del día', () => {
    expect(startOfDayIso('2026-10-17')).toBe(new Date(2026, 9, 17).toISOString())
  })

  it('suma días, cruzando meses', () => {
    expect(startOfDayIso('2026-10-31', 1)).toBe(new Date(2026, 10, 1).toISOString())
  })
})
