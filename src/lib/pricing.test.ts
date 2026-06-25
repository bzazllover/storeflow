import { describe, it, expect } from 'vitest'
import { cartTotals, profitMargin, lineTotal } from './pricing'

describe('pricing', () => {
  it('computes a line total with discount', () => {
    expect(lineTotal(3, 100, 50)).toBe(250)
  })
  it('computes cart totals with tax', () => {
    const t = cartTotals([{ qty: 2, unitPrice: 100 }, { qty: 1, unitPrice: 50 }], 0, 19)
    expect(t.subtotal).toBe(250)
    expect(t.tax).toBe(47.5)
    expect(t.total).toBe(297.5)
  })
  it('applies discount before tax', () => {
    const t = cartTotals([{ qty: 1, unitPrice: 1000 }], 100, 10)
    expect(t.tax).toBe(90)
    expect(t.total).toBe(990)
  })
  it('computes profit margin', () => {
    expect(profitMargin(60, 100)).toBe(40)
    expect(profitMargin(0, 0)).toBe(0)
  })
})
