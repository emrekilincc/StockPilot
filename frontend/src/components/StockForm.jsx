import { useState } from 'react'
import { api } from '../services/api'
import { useMutation } from '../hooks/useMutation'
import { Button, EntityPicker, ErrorMessage, Field, Modal } from './ui'

export default function StockForm({ product, onClose, onSaved }) {
  const [selected, setSelected] = useState(product)
  const [kind, setKind] = useState('in')
  const { busy, error, run } = useMutation()
  function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    run(async () => {
      await api('/inventory', { method: 'POST', body: { ...values, product_id: selected.id, quantity: Number(values.quantity) } })
      onSaved()
    }, 'Stok hareketi kaydedildi.')
  }
  return <Modal title="Stok hareketi oluştur" onClose={() => !busy && onClose()}><form onSubmit={submit}>
    <EntityPicker endpoint="products" label="Ürün" value={selected?.id} initialLabel={selected?.name} onChange={setSelected} />
    {selected && <p className="info-strip">Mevcut stok: <strong>{selected.stock} adet</strong></p>}
    <Field label="İşlem türü"><select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}><option value="in">Stok girişi</option><option value="out">Stok çıkışı</option><option value="adjustment">Sayım düzeltmesi</option></select></Field>
    <Field label={kind === 'adjustment' ? 'Sayım sonrası gerçek stok' : 'İşlem adedi'} hint={kind === 'adjustment' ? 'Yeni toplam stok miktarını girin.' : undefined}><input name="quantity" type="number" min={kind === 'adjustment' ? 0 : 1} max="1000000" step="1" required /></Field>
    <Field label="İşlem açıklaması"><textarea name="note" minLength={3} maxLength={1000} required rows={3} placeholder="Örn. Yeni tedarik teslim alındı" /></Field><ErrorMessage message={error} /><div className="modal-actions"><Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Vazgeç</Button><Button type="submit" busy={busy} disabled={!selected}>Hareketi kaydet</Button></div>
  </form></Modal>
}
