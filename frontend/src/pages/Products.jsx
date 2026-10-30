import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, Plus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useDebounce, useResource } from '../hooks/useResource'
import { queryString } from '../services/api'
import { Badge, ErrorMessage, Loading, PageHeader, Pagination, ProductAvatar, SearchInput, Table } from '../components/ui'
import ProductForm from '../components/ProductForm'
import { money, number } from '../utils/format'

export default function Products() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const search = useDebounce(q)
  const [showForm, setShowForm] = useState(false)
  const navigate = useNavigate()
  const { can } = useAuth()
  const { data: categories } = useResource('/categories')
  const values = { page: params.get('page') || 1, category_id: params.get('category_id') || '', stock_status: params.get('stock_status') || 'all', sort: params.get('sort') || 'newest', archived: params.get('archived') || 'false' }
  const { data, loading, error, reload } = useResource(`/products?${queryString({ ...values, q: search })}`)
  function filter(key, value) { setParams((p) => { p.set(key, value); if (key !== 'page') p.delete('page'); return p }) }
  return <div className="page-enter"><PageHeader title="Ürünler" subtitle="Ürün kataloğunuzu ve stok seviyelerinizi kolayca yönetin.">{can('products') && <button className="button primary" onClick={() => setShowForm(true)}><Plus size={17} />Yeni ürün</button>}</PageHeader>
    <div className="panel"><div className="panel-tabs"><button className={values.archived === 'false' ? 'active' : ''} onClick={() => filter('archived', 'false')}>Aktif ürünler{values.archived === 'false' && <span>{data?.total ?? '—'}</span>}</button><button className={values.archived === 'true' ? 'active' : ''} onClick={() => filter('archived', 'true')}>Arşiv</button></div>
    <div className="toolbar"><SearchInput value={q} onChange={(v) => { setQ(v); filter('q', v) }} placeholder="Ürün adı veya SKU ara…" /><select aria-label="Kategori filtresi" value={values.category_id} onChange={(e) => filter('category_id', e.target.value)}><option value="">Tüm kategoriler</option>{categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select aria-label="Stok filtresi" value={values.stock_status} onChange={(e) => filter('stock_status', e.target.value)}><option value="all">Tüm stok durumları</option><option value="available">Stokta</option><option value="critical">Kritik stok</option><option value="empty">Stok tükendi</option></select><select aria-label="Sıralama" value={values.sort} onChange={(e) => filter('sort', e.target.value)}><option value="newest">En yeni</option><option value="name">Ürün adı</option><option value="price_asc">Fiyat: düşükten yükseğe</option><option value="price_desc">Fiyat: yüksekten düşüğe</option></select></div>
    {error ? <ErrorMessage message={error} retry={reload} /> : loading ? <Loading /> : <><Table rows={data?.items} columns={[
      { key: 'name', label: 'ÜRÜN', render: (p) => <Link to={`/products/${p.id}`} className="product-cell"><ProductAvatar product={p} /><span>{p.name}<small>{p.sku}</small></span></Link> },
      { key: 'category_name', label: 'KATEGORİ' }, { key: 'sale_price', label: 'SATIŞ FİYATI', render: (p) => <strong>{money(p.sale_price)}</strong> },
      { key: 'stock', label: 'STOK', render: (p) => <span className="stock-number">{number(p.stock)} <small>adet</small></span> },
      { key: 'status', label: 'DURUM', render: (p) => <Badge tone={p.stock <= p.critical_stock ? 'warning' : 'success'}>{p.stock === 0 ? 'Tükendi' : p.stock <= p.critical_stock ? 'Kritik stok' : 'Stokta'}</Badge> },
      { key: 'action', label: '', render: (p) => <Link className="icon-button" aria-label={`${p.name} detayları`} to={`/products/${p.id}`}><ArrowUpRight size={18} /></Link> },
    ]} /><Pagination data={data} onPage={(page) => filter('page', String(page))} /></>}
    </div>{showForm && <ProductForm onClose={() => setShowForm(false)} onSaved={(p) => navigate(`/products/${p.id}`)} />}
  </div>
}
