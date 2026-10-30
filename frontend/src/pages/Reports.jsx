import { useState } from 'react'
import { Download, FileBarChart2 } from 'lucide-react'
import { useResource } from '../hooks/useResource'
import { queryString } from '../services/api'
import { ErrorMessage, Loading, PageHeader, Table } from '../components/ui'
import { money, movements, number, statuses } from '../utils/format'

const reportTypes = { daily: 'Günlük satışlar', monthly: 'Aylık satışlar', products: 'Ürün bazlı satışlar', categories: 'Kategori bazlı satışlar', stock: 'Stok giriş / çıkış', critical: 'Kritik stok', orders: 'Sipariş durumları' }
export default function Reports() {
  const [kind, setKind] = useState('monthly')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const query = queryString({ kind, start, end })
  const { data, loading, error, reload } = useResource(`/reports/sales?${query}`)
  const isStock = kind === 'stock', isCritical = kind === 'critical'
  const columns = [{ key: 'label', label: isStock ? 'İŞLEM TÜRÜ' : isCritical ? 'ÜRÜN' : kind === 'orders' ? 'DURUM' : 'DÖNEM / KAYIT', render: (r) => <strong>{isStock ? movements[r.label] : kind === 'orders' ? statuses[r.label] : r.label}</strong> }]
  if (!isCritical) columns.push({ key: 'count', label: isStock ? 'HAREKET SAYISI' : ['products', 'categories'].includes(kind) ? 'SATILAN ADET' : 'SİPARİŞ SAYISI', render: (r) => number(r.count) })
  if (isCritical || isStock) columns.push({ key: 'quantity', label: isCritical ? 'MEVCUT STOK' : 'NET STOK DEĞİŞİMİ', render: (r) => number(r.quantity) })
  if (isCritical) columns.push({ key: 'threshold', label: 'KRİTİK SEVİYE' })
  if (!isCritical && !isStock) columns.push({ key: 'amount', label: 'TUTAR', className: 'text-right', render: (r) => <strong>{money(r.amount)}</strong> })
  return <div className="page-enter"><PageHeader title="Raporlar" subtitle="Veriye dayalı kararlar için işletmenizin net bir resmi."><a className="button primary" href={`/api/reports/export?${query}`} download><Download size={17} />CSV dışa aktar</a></PageHeader><div className="reports-layout"><aside className="panel report-nav" aria-label="Rapor türleri">{Object.entries(reportTypes).map(([value, label]) => <button key={value} className={kind === value ? 'active' : ''} onClick={() => setKind(value)}><FileBarChart2 size={17} />{label}</button>)}</aside><section className="panel"><div className="report-header"><h2>{reportTypes[kind]}</h2><p>{isCritical ? 'Anlık stok görüntüsüdür. Tarih filtresi, ürünün oluşturulma tarihine uygulanır.' : isStock ? 'Stok hareketlerinin işlem tarihine göre özeti.' : kind === 'orders' ? 'Sipariş oluşturulma tarihine göre durum dağılımı. Tutarlar satış geliri değildir.' : 'Yalnızca tamamlanan siparişler, tamamlanma tarihine göre hesaplanır.'}</p></div><div className="toolbar"><label className="inline-date">Başlangıç<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label><label className="inline-date">Bitiş<input type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} /></label>{(start || end) && <button className="text-button" onClick={() => { setStart(''); setEnd('') }}>Tüm zamanlar</button>}</div>{error ? <ErrorMessage message={error} retry={reload} /> : loading ? <Loading /> : <><Table rows={data?.items} columns={columns} rowKey="label" />{!isCritical && !isStock && Boolean(data?.items.length) && <div className="report-total"><span>Toplam tutar</span><strong>{money(data.items.reduce((sum, r) => sum + r.amount, 0))}</strong></div>}</>}</section></div></div>
}
