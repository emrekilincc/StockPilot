import { useState } from 'react'
import { Check, ChevronRight, Pencil, X } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useResource } from '../hooks/useResource'
import { useMutation } from '../hooks/useMutation'
import { api } from '../services/api'
import { Badge, Button, ErrorMessage, Loading, Modal, PageHeader, SectionTitle, Table } from '../components/ui'
import OrderForm from '../components/OrderForm'
import { date, money, statuses } from '../utils/format'

export default function OrderDetail() {
  const { id } = useParams()
  const { can } = useAuth()
  const { data: order, loading, error, reload } = useResource(`/orders/${id}`)
  const [modal, setModal] = useState('')
  const mutation = useMutation()
  if (loading) return <Loading />
  if (error) return <ErrorMessage message={error} retry={reload} />
  const next = { Pending: 'Confirmed', Confirmed: 'Processing', Processing: 'Completed' }[order.status]
  const action = { Pending: 'Siparişi onayla', Confirmed: 'Hazırlamaya başla', Processing: 'Siparişi tamamla' }[order.status]
  const change = (status) => mutation.run(async () => { await api(`/orders/${id}/status`, { method: 'POST', body: { status } }); setModal(''); reload() }, 'Sipariş durumu güncellendi.')
  return <div className="page-enter"><PageHeader title={order.number} subtitle={`${date(order.created_at, true)} tarihinde oluşturuldu`} back="/orders">{can('orders') && next && <>
    <Button variant="secondary" onClick={() => setModal('cancel')}><X size={16} />İptal et</Button>{order.status === 'Pending' && <Button variant="secondary" onClick={() => setModal('edit')}><Pencil size={16} />Düzenle</Button>}<Button busy={mutation.busy} onClick={() => change(next)}><Check size={17} />{action}</Button>
  </>}</PageHeader><ErrorMessage message={mutation.error} /><div className="order-summary-strip panel"><div><small>SİPARİŞ DURUMU</small><Badge status={order.status} /></div><div><small>MÜŞTERİ</small><Link to={`/customers/${order.customer_id}`} className="table-link">{order.customer_name}</Link></div><div><small>TOPLAM ÜRÜN</small><strong>{order.item_count} adet</strong></div><div><small>SİPARİŞ TOPLAMI</small><strong className="order-summary-total">{money(order.total)}</strong></div></div>
    <div className="detail-two-columns"><section className="panel"><SectionTitle title="Sipariş kalemleri" subtitle="Siparişe kaydedilen ürün ve fiyat bilgileri" /><Table rows={order.items} columns={[
      { key: 'product_name', label: 'ÜRÜN', render: (r) => <Link to={`/products/${r.product_id}`} className="cell-title">{r.product_name}<small>{r.sku}</small></Link> },
      { key: 'quantity', label: 'ADET' }, { key: 'unit_price', label: 'BİRİM FİYAT', render: (r) => money(r.unit_price) },
      { key: 'total', label: 'TOPLAM', className: 'text-right', render: (r) => <strong>{money(r.unit_price * r.quantity)}</strong> },
    ]} /><div className="order-note"><h3>Sipariş notu</h3><p>{order.notes || 'Bu siparişe not eklenmemiş.'}</p></div></section><section className="panel"><SectionTitle title="Sipariş geçmişi" /><ol className="timeline">{order.events.map((e, index) => <li key={e.id}><span className={`timeline-marker ${index === order.events.length - 1 ? 'current' : ''}`}><Check size={12} /></span><div><strong>{statuses[e.status]}</strong><p>{e.note}</p><small>{e.user_name} · {date(e.created_at, true)}</small></div></li>)}</ol></section></div>
    {modal === 'edit' && <OrderForm order={order} onClose={() => setModal('')} onSaved={() => { setModal(''); reload() }} />}
    {modal === 'cancel' && <Modal title="Sipariş iptal edilsin mi?" onClose={() => setModal('')}><p className="modal-description">{order.status === 'Pending' ? 'Bu sipariş iptal edilecek. Henüz stok düşülmediği için stok değişmeyecek.' : 'Bu sipariş iptal edilecek ve düşülen ürün stokları geri yüklenecek.'} Bu işlem geri alınamaz.</p><ErrorMessage message={mutation.error} /><div className="modal-actions"><Button variant="secondary" onClick={() => setModal('')}>Vazgeç</Button><Button variant="danger" busy={mutation.busy} onClick={() => change('Cancelled')}>İptali onayla</Button></div></Modal>}
  </div>
}
