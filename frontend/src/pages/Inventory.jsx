import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useResource } from '../hooks/useResource'
import { queryString } from '../services/api'
import { Badge, EntityPicker, ErrorMessage, Loading, PageHeader, Pagination, Table } from '../components/ui'
import StockForm from '../components/StockForm'
import { date, movements } from '../utils/format'

export function MovementTable({ rows }) {
  return <Table rows={rows} columns={[
    { key: 'product_name', label: 'ÜRÜN', render: (r) => <Link to={`/products/${r.product_id}`} className="cell-title table-link">{r.product_name}<small>{r.sku}</small></Link> },
    { key: 'kind', label: 'İŞLEM', render: (r) => <Badge tone={r.delta > 0 ? 'success' : 'neutral'}>{movements[r.kind]}</Badge> },
    { key: 'delta', label: 'DEĞİŞİM', render: (r) => <b className={r.delta > 0 ? 'positive-text' : 'negative-text'}>{r.delta > 0 ? '+' : ''}{r.delta}</b> },
    { key: 'balance', label: 'SON STOK' }, { key: 'note', label: 'AÇIKLAMA', render: (r) => <span className="wrap-cell">{r.note}</span> },
    { key: 'user_name', label: 'İŞLEMİ YAPAN' }, { key: 'created_at', label: 'TARİH', render: (r) => date(r.created_at, true) },
  ]} />
}

export default function Inventory() {
  const [page, setPage] = useState(1)
  const [product, setProduct] = useState(null)
  const [kind, setKind] = useState('')
  const [show, setShow] = useState(false)
  const { can } = useAuth()
  const { data, loading, error, reload } = useResource(`/inventory?${queryString({ page, product_id: product?.id, kind })}`)
  return <div className="page-enter"><PageHeader title="Stok hareketleri" subtitle="Her giriş, her çıkış. Stoklarınızın eksiksiz hikâyesi.">{can('stock') && <button className="button primary" onClick={() => setShow(true)}><Plus size={17} />Stok hareketi ekle</button>}</PageHeader><div className="panel"><div className="toolbar inventory-toolbar"><EntityPicker endpoint="products" label="Ürün filtresi" value={product?.id} initialLabel={product?.name} onChange={(p) => { setProduct(p); setPage(1) }} />{product && <button className="text-button" onClick={() => { setProduct(null); setPage(1) }}>Filtreyi temizle</button>}<select aria-label="İşlem türü filtresi" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1) }}><option value="">Tüm işlem türleri</option>{Object.entries(movements).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{error ? <ErrorMessage message={error} retry={reload} /> : loading ? <Loading /> : <><MovementTable rows={data?.items} /><Pagination data={data} onPage={setPage} /></>}</div>{show && <StockForm product={product} onClose={() => setShow(false)} onSaved={() => { setShow(false); reload() }} />}</div>
}
