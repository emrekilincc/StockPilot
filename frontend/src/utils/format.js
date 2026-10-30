export const money = (cents = 0) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(cents / 100)
export const number = (value = 0) => new Intl.NumberFormat('tr-TR').format(value)
export const date = (value, withTime = false) => value ? new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
}).format(new Date(value.endsWith('Z') || value.includes('+') ? value : value + 'Z')) : '—'
export const initials = (name = '') => name.split(' ').slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('tr')
export const statuses = { Pending: 'Bekliyor', Confirmed: 'Onaylandı', Processing: 'Hazırlanıyor', Completed: 'Tamamlandı', Cancelled: 'İptal edildi' }
export const movements = { in: 'Stok girişi', out: 'Stok çıkışı', adjustment: 'Sayım düzeltmesi', order: 'Sipariş çıkışı', return: 'İptal iadesi' }
export const cents = (value) => Math.round(Number(value) * 100)
