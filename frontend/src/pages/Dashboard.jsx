import { ArrowDownLeft, ArrowUpRight, Boxes, CalendarDays, CircleDollarSign, Package, Plus, ShoppingBag, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { useAuth } from '../contexts/AuthContext'
import { Badge, Empty, ErrorMessage, Loading, PageHeader, ProductAvatar, SectionTitle, Table } from '../components/ui'
import { Distribution, SalesChart } from '../components/Charts'
import { date, money, movements, number, statuses } from '../utils/format'

export default function Dashboard() {
  const { data, loading, error, reload } = useResource('/dashboard/summary')
  const { user, can } = useAuth()
  if (loading) return <><PageHeader title="Genel bakış" subtitle="İşletmenizin nabzı, tek bir ekranda." /><Loading rows={6} /></>
  if (error) return <ErrorMessage message={error} retry={reload} />
  const stats = [
    { title: 'Bu ayki satışlar', value: money(data.monthly_sales), icon: CircleDollarSign, note: 'Tamamlanan siparişlerden', color: 'indigo' },
    { title: 'Toplam sipariş', value: number(data.order_count), icon: ShoppingBag, note: `${number(data.completed_count)} sipariş tamamlandı`, color: 'blue' },
    { title: 'Aktif ürün', value: number(data.product_count), icon: Package, note: `${data.categories.length} farklı kategoride`, color: 'violet' },
    { title: 'Toplam stok', value: number(data.stock_total), icon: Boxes, note: `${data.critical_count} ürün kritik seviyede`, color: 'teal' },
  ]
  return <div className="page-enter"><PageHeader title="Genel bakış" subtitle={`Merhaba ${user.name.split(' ')[0]}, işletmenizde bugün neler oluyor?`}>
    {user.role === 'admin' && <Link className="button secondary" to="/reports">Raporları görüntüle<ArrowUpRight size={16} /></Link>}
    {can('orders') && <Link className="button primary" to="/orders?new=1"><Plus size={17} />Yeni sipariş</Link>}
  </PageHeader>
  <div className="stat-grid">{stats.map(({ title, value, icon: Icon, note, color }) => <article className="stat-card" key={title}><div className="stat-top"><span>{title}</span><span className={`stat-icon ${color}`}><Icon size={19} /></span></div><strong className="stat-value">{value}</strong><div className="stat-note">{title === 'Toplam stok' && data.critical_count > 0 ? <TriangleAlert size={13} className="warning-text" /> : <span className="tiny-dot" />}{note}</div></article>)}</div>
  <div className="dashboard-grid"><section className="panel sales-panel"><SectionTitle title="Satış performansı" subtitle="Tamamlanan siparişlerin aylık görünümü" /><div className="chart-heading"><div><strong>{money(data.sales.reduce((sum, row) => sum + row.amount, 0))}</strong><span>Son 6 ay toplamı</span></div><span className="period-label"><CalendarDays size={14} />Son 6 ay</span></div><SalesChart data={data.sales} /><div className="chart-footnote"><span className="tiny-dot" />Net sipariş tutarı · Türk lirası</div></section>
  <section className="panel"><SectionTitle title="Sipariş dağılımı" subtitle="Tüm siparişlerin güncel durumu" /><Distribution data={data.statuses} labels={statuses} donut /></section></div>
  <div className="dashboard-grid"><section className="panel"><SectionTitle title="Son siparişler" subtitle="Operasyonunuzdaki son hareketler" to="/orders" /><Table rows={data.recent_orders} columns={[
    { key: 'number', label: 'SİPARİŞ', render: (r) => <Link className="table-link" to={`/orders/${r.id}`}>{r.number}</Link> },
    { key: 'customer_name', label: 'MÜŞTERİ', render: (r) => <div className="cell-title">{r.customer_name}<small>{date(r.created_at)}</small></div> },
    { key: 'status', label: 'DURUM', render: (r) => <Badge status={r.status} /> },
    { key: 'total', label: 'TUTAR', className: 'text-right', render: (r) => <strong>{money(r.total)}</strong> },
  ]} /></section>
  <section className="panel critical-panel"><SectionTitle title="Stok uyarıları" subtitle={`${data.critical_count} ürün ilginizi bekliyor`} to="/products?stock_status=critical" linkText="İncele" />{data.critical_products.length ? <div className="critical-list">{data.critical_products.map((p) => <Link key={p.id} to={`/products/${p.id}`}><ProductAvatar product={p} /><div><strong>{p.name}</strong><small>{p.sku}</small></div><span className="stock-alert">{p.stock}<small>kalan</small></span></Link>)}</div> : <Empty title="Stoklar yolunda" description="Kritik seviyede ürün bulunmuyor." />}</section></div>
  <div className="dashboard-three"><section className="panel"><SectionTitle title="En çok satanlar" subtitle="Tamamlanan siparişlere göre" />{data.top_products.length ? <div className="rank-list">{data.top_products.map((p, index) => <div key={p.name}><span className="rank">{String(index + 1).padStart(2, '0')}</span><div><strong>{p.name}</strong><small>{p.quantity} adet satıldı</small></div><b>{money(p.amount)}</b></div>)}</div> : <Empty />}</section><section className="panel"><SectionTitle title="Ürün kategorileri" subtitle="Aktif ürünlerin dağılımı" /><Distribution data={data.categories} /></section><section className="panel"><SectionTitle title="Stok özeti" subtitle="Bu ay hareket eden ürün adetleri" /><Distribution data={data.movement_summary} labels={movements} /></section></div>
  <section className="panel"><SectionTitle title="Son stok hareketleri" to="/inventory" /><div className="activity-list">{data.recent_movements.map((m) => <div key={m.id}><span className={`activity-icon ${m.delta > 0 ? 'positive' : 'negative'}`}>{m.delta > 0 ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span><div><strong>{m.product_name}</strong><small>{movements[m.kind]} · {m.user_name}</small></div><span className="activity-date">{date(m.created_at, true)}</span><b className={m.delta > 0 ? 'positive-text' : 'negative-text'}>{m.delta > 0 ? '+' : ''}{m.delta}</b></div>)}{!data.recent_movements.length && <Empty />}</div></section>
  </div>
}
