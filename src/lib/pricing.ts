export function lineTotal(qty: number, unitPrice: number, discount = 0) {
  return qty * unitPrice - discount
}
export function cartTotals(items: { qty: number; unitPrice: number }[], discount: number, taxRate: number) {
  const subtotal = items.reduce((s, i) => s + lineTotal(i.qty, i.unitPrice), 0)
  const tax = Math.round((subtotal - discount) * taxRate) / 100
  return { subtotal, tax, total: subtotal - discount + tax }
}
export function profitMargin(cost: number, price: number) {
  return price === 0 ? 0 : Math.round((price - cost) / price * 10000) / 100
}
