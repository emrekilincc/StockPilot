import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useDebounce, useResource } from '../hooks/useResource'
import { queryString } from '../services/api'
import { Badge, Button, ErrorMessage, Loading, PageHeader, Pagination, SearchInput, Table } from '../components/ui'
import OrderForm from '../components/OrderForm'
import { date, money, statuses } from '../utils/format'

export function OrderTable({ rows }) {
  return <Table rows={rows} columns={[
    { key: 'number', label: 'SİPARİŞ NO', render: (r) => <Link className="table-link" to={`/orders/${r.id}`}>{r.number}</Link> },
    { key: 'customer_name', label: 'MÜŞTERİ', render: (r) => <Link to={`/customers/${r.customer_id}`}>{r.customer_name}</Link> },
    { key: 'created_at', label: 'TARİH', render: (r) => date(r.created_at) },
    { key: 'item_count', label: 'ÜRÜN ADEDİ' }, { key: 'status', label: 'DURUM', render: (r) => <Badge status={r.status} /> },
    { key: 'total', label: 'TUTAR', className: 'text-right', render: (r) => <strong>{money(r.total)}</strong> },
  ]} />
}

export default function Orders() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const search = useDebounce(q)
  const navigate = useNavigate()
  const { can, user } = useAuth()
  const show = params.get('new') === '1'
  const values = { page: params.get('page') || 1, status: params.get('status') || '', start: params.get('start') || '', end: params.get('end') || '' }
  const { data, error, loading, reload } = useResource(`/orders?${queryString({ ...values, q: search })}`)
  function change(key, value) { setParams((p) => { if (value) p.set(key, value); else p.delete(key); if (key !== 'page') p.delete('page'); return p }) }
  return <div className="page-enter"><PageHeader title="Siparişler" subtitle={user.role === 'admin' ? 'İlk talepten teslimata kadar, tüm siparişleriniz burada.' : 'Oluşturduğunuz siparişleri takip edin ve yönetin.'}>{can('orders') && <Button onClick={() => change('new', '1')}><Plus size={17} />Yeni sipariş</Button>}</PageHeader><div className="panel"><div className="toolbar"><SearchInput value={q} onChange={(v) => { setQ(v); change('q', v) }} placeholder="Sipariş no veya müşteri ara…" /><select aria-label="Sipariş durumu" value={values.status} onChange={(e) => change('status', e.target.value)}><option value="">Tüm durumlar</option>{Object.entries(statuses).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select><label className="inline-date">Başlangıç<input type="date" value={values.start} onChange={(e) => change('start', e.target.value)} /></label><label className="inline-date">Bitiş<input type="date" value={values.end} min={values.start} onChange={(e) => change('end', e.target.value)} /></label></div>{error ? <ErrorMessage message={error} retry={reload} /> : loading ? <Loading /> : <><OrderTable rows={data?.items} /><Pagination data={data} onPage={(page) => change('page', String(page))} /></>}</div>
    {show && can('orders') && <OrderForm onClose={() => change('new', '')} onSaved={(o) => navigate(`/orders/${o.id}`)} />}
  </div>
}
