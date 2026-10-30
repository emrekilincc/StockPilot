import { useState } from 'react'
import { api } from '../services/api'
import { useResource } from '../hooks/useResource'
import { useMutation } from '../hooks/useMutation'
import { cents } from '../utils/format'
import { Button, EntityPicker, ErrorMessage, Field, Modal } from './ui'

export default function ProductForm({ product, onClose, onSaved }) {
  const { data: categories, error: categoryError } = useResource('/categories')
  const [supplier, setSupplier] = useState(product?.supplier_id || null)
  const { busy, error, run } = useMutation()
  function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const body = { ...values, category_id: Number(values.category_id), supplier_id: supplier,
      sale_price: cents(values.sale_price), purchase_price: cents(values.purchase_price), critical_stock: Number(values.critical_stock) }
    run(async () => {
      const result = await api(product ? `/products/${product.id}` : '/products', { method: product ? 'PATCH' : 'POST', body })
      onSaved(result)
    }, product ? 'Ürün güncellendi.' : 'Ürün oluşturuldu. Stok girişini ürün detayından yapabilirsiniz.')
  }
  return <Modal title={product ? 'Ürünü düzenle' : 'Yeni ürün'} onClose={() => !busy && onClose()} wide><form onSubmit={submit}>
    <div className="form-grid"><Field label="Ürün adı"><input name="name" required minLength={2} maxLength={160} defaultValue={product?.name} placeholder="Örn. Kablosuz Klavye" /></Field><Field label="SKU"><input name="sku" required minLength={2} maxLength={60} pattern="[A-Za-z0-9_.\-]+" defaultValue={product?.sku} placeholder="Örn. ELK-001" /></Field>
    <Field label="Kategori"><select name="category_id" required defaultValue={product?.category_id || ''}><option value="" disabled>Kategori seçin</option>{categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
    <div><EntityPicker endpoint="suppliers" label="Tedarikçi (isteğe bağlı)" value={supplier} initialLabel={product?.supplier_name} extra={{ active: true }} onChange={(row) => setSupplier(row.id)} />{supplier && <button type="button" className="text-button" onClick={() => setSupplier(null)}>Seçimi kaldır</button>}</div>
    <Field label="Satış fiyatı (₺)"><input name="sale_price" type="number" min="0" max="100000000" step="0.01" required defaultValue={product ? product.sale_price / 100 : ''} placeholder="0,00" /></Field><Field label="Alış fiyatı (₺)"><input name="purchase_price" type="number" min="0" max="100000000" step="0.01" required defaultValue={product ? product.purchase_price / 100 : ''} placeholder="0,00" /></Field>
    <Field label="Kritik stok seviyesi" hint="Stok bu seviyeye indiğinde uyarı gösterilir."><input name="critical_stock" type="number" min="0" max="1000000" step="1" required defaultValue={product?.critical_stock ?? 10} /></Field>
    <Field label="Açıklama" className="span-2"><textarea name="description" maxLength={5000} rows={3} defaultValue={product?.description} /></Field></div>
    {!categories?.length && !categoryError && <p className="muted">Ürün eklemek için önce Kategoriler sayfasında bir kategori oluşturun.</p>}
    <ErrorMessage message={error || categoryError} /><div className="modal-actions"><Button type="button" variant="secondary" disabled={busy} onClick={onClose}>Vazgeç</Button><Button type="submit" busy={busy} disabled={!categories?.length}>Ürünü kaydet</Button></div>
  </form></Modal>
}
