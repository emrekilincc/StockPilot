import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../services/api'
import { useMutation } from '../hooks/useMutation'
import { money } from '../utils/format'
import { Button, EntityPicker, ErrorMessage, Field, Modal } from './ui'

export default function OrderForm({ order, onClose, onSaved }) {
  const [customer, setCustomer] = useState(order?.customer_id || null)
  const [lines, setLines] = useState(order?.items.map((item) => ({ product_id: item.product_id, name: item.product_name, quantity: item.quantity, price: item.unit_price })) || [])
  const [selected, setSelected] = useState(null)
  const { busy, error, run } = useMutation()
  function add() {
    if (!selected) return
    setLines((old) => old.some((line) => line.product_id === selected.id) ? old.map((line) => line.product_id === selected.id ? { ...line, quantity: line.quantity + 1 } : line) : [...old, { product_id: selected.id, name: selected.name, quantity: 1, price: selected.sale_price }])
    setSelected(null)
  }
  function submit(event) {
    event.preventDefault()
    const body = { customer_id: customer, notes: new FormData(event.currentTarget).get('notes'), items: lines.map(({ product_id, quantity }) => ({ product_id, quantity })) }
    run(async () => { const result = await api(order ? `/orders/${order.id}` : '/orders', { method: order ? 'PATCH' : 'POST', body }); onSaved(result) }, 'Sipariş kaydedildi.')
  }
  return <Modal title={order ? 'Siparişi düzenle' : 'Yeni sipariş'} onClose={() => !busy && onClose()} wide><form onSubmit={submit}>
    <EntityPicker endpoint="customers" label="Müşteri" value={customer} initialLabel={order?.customer_name} extra={{ active: true }} onChange={(row) => setCustomer(row.id)} />
    <div className="order-add-line"><EntityPicker endpoint="products" label="Siparişe ürün ekle" value={selected?.id} initialLabel={selected?.name} onChange={setSelected} /><Button type="button" variant="secondary" disabled={!selected || lines.length >= 100} onClick={add}><Plus size={16} />Ekle</Button></div>
    <div className="order-lines">{lines.map((line) => <div className="order-line" key={line.product_id}><span>{line.name}<small>{money(line.price)} / adet</small></span><input type="number" aria-label={`${line.name} adedi`} required min="1" max="10000" step="1" value={line.quantity} onChange={(e) => setLines((old) => old.map((item) => item.product_id === line.product_id ? { ...item, quantity: e.target.value === '' ? '' : Number(e.target.value) } : item))} /><strong>{money(line.price * (line.quantity || 0))}</strong><button type="button" className="icon-button" aria-label={`${line.name} kaldır`} onClick={() => setLines((old) => old.filter((item) => item.product_id !== line.product_id))}><Trash2 size={16} /></button></div>)}{!lines.length && <p className="order-lines-empty">Sipariş için en az bir ürün ekleyin.</p>}</div>
    <div className="order-total"><span>Tahmini toplam</span><strong>{money(lines.reduce((sum, line) => sum + line.price * (line.quantity || 0), 0))}</strong></div><p className="form-hint">Toplam, kaydetme sırasında güncel ürün fiyatlarıyla hesaplanır. Stok, sipariş onaylandığında düşer.</p>
    <Field label="Sipariş notu (isteğe bağlı)"><textarea name="notes" maxLength={2000} rows={2} defaultValue={order?.notes} /></Field><ErrorMessage message={error} /><div className="modal-actions"><Button type="button" variant="secondary" disabled={busy} onClick={onClose}>Vazgeç</Button><Button type="submit" disabled={!customer || !lines.length} busy={busy}>Siparişi kaydet</Button></div>
  </form></Modal>
}
