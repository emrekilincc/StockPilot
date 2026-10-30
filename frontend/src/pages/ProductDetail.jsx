import { useState } from 'react'
import { Archive, ImagePlus, Pencil, Plus, RotateCcw } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useResource } from '../hooks/useResource'
import { useMutation } from '../hooks/useMutation'
import { api } from '../services/api'
import { Badge, Button, ErrorMessage, Loading, Modal, PageHeader, Pagination, ProductAvatar, SectionTitle } from '../components/ui'
import ProductForm from '../components/ProductForm'
import StockForm from '../components/StockForm'
import { MovementTable } from './Inventory'
import { date, money, number } from '../utils/format'

export default function ProductDetail() {
  const { id } = useParams()
  const { can } = useAuth()
  const [modal, setModal] = useState('')
  const [page, setPage] = useState(1)
  const { data: product, loading, error, reload } = useResource(`/products/${id}`)
  const history = useResource(`/inventory?product_id=${id}&page=${page}`)
  const mutation = useMutation()
  const saved = () => { setModal(''); reload(); history.reload() }
  if (loading) return <Loading />
  if (error) return <ErrorMessage message={error} retry={reload} />
  function upload(event) {
    const file = event.target.files[0]
    if (!file) return
    mutation.run(async () => { const body = new FormData(); body.append('file', file); await api(`/products/${id}/image`, { method: 'POST', body }); reload() }, 'Ürün görseli güncellendi.')
    event.target.value = ''
  }
  return <div className="page-enter"><PageHeader title={product.name} subtitle={`${product.sku} · ${product.category_name}`} back="/products">
    {can('products') && <Button variant="secondary" onClick={() => setModal('archive')}>{product.archived ? <RotateCcw size={17} /> : <Archive size={17} />}{product.archived ? 'Arşivden çıkar' : 'Arşivle'}</Button>}
    {can('products') && !product.archived && <Button variant="secondary" onClick={() => setModal('edit')}><Pencil size={17} />Düzenle</Button>}
    {can('stock') && !product.archived && <Button onClick={() => setModal('stock')}><Plus size={17} />Stok hareketi</Button>}
  </PageHeader><ErrorMessage message={mutation.error} /><div className="product-overview panel"><div className="product-visual"><ProductAvatar product={product} large />{can('products') && <label className={`button secondary upload-button ${mutation.busy ? 'disabled' : ''}`}><ImagePlus size={16} />{mutation.busy ? 'Yükleniyor…' : 'Görsel yükle'}<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Ürün görseli yükle" disabled={mutation.busy} onChange={upload} /></label>}<small>PNG, JPEG veya WebP · En fazla 5 MB</small></div><div className="product-info"><div className="product-heading"><span className="eyebrow">ÜRÜN BİLGİLERİ</span><Badge tone={product.archived ? 'neutral' : product.stock <= product.critical_stock ? 'warning' : 'success'}>{product.archived ? 'Arşivlenmiş' : product.stock <= product.critical_stock ? 'Kritik stok' : 'Stokta'}</Badge></div><p className="description">{product.description || 'Bu ürün için açıklama eklenmemiş.'}</p><div className="detail-stats"><div><span>Satış fiyatı</span><strong>{money(product.sale_price)}</strong></div><div><span>Alış fiyatı</span><strong>{money(product.purchase_price)}</strong></div><div><span>Mevcut stok</span><strong>{number(product.stock)} <small>adet</small></strong></div></div><dl className="detail-list"><div><dt>Kategori</dt><dd>{product.category_name}</dd></div><div><dt>Tedarikçi</dt><dd>{product.supplier_name || 'Belirtilmedi'}</dd></div><div><dt>Kritik stok seviyesi</dt><dd>{product.critical_stock} adet</dd></div><div><dt>Oluşturulma tarihi</dt><dd>{date(product.created_at)}</dd></div><div><dt>Son güncelleme</dt><dd>{date(product.updated_at, true)}</dd></div></dl></div></div>
    <section className="panel"><SectionTitle title="Stok hareket geçmişi" subtitle="Bu ürüne ait tüm stok işlemleri" />{history.error ? <ErrorMessage message={history.error} retry={history.reload} /> : history.loading ? <Loading /> : <><MovementTable rows={history.data?.items} /><Pagination data={history.data} onPage={setPage} /></>}</section>
    {modal === 'edit' && <ProductForm product={product} onClose={() => setModal('')} onSaved={saved} />}{modal === 'stock' && <StockForm product={product} onClose={() => setModal('')} onSaved={saved} />}
    {modal === 'archive' && <Modal title={product.archived ? 'Ürün yeniden aktifleştirilsin mi?' : 'Ürün arşivlensin mi?'} onClose={() => setModal('')}><p className="modal-description">{product.archived ? 'Ürün, aktif ürün kataloğuna geri dönecek.' : 'Ürün yeni siparişlerde kullanılamayacak. Mevcut sipariş ve stok geçmişi korunacak.'}</p><ErrorMessage message={mutation.error} /><div className="modal-actions"><Button variant="secondary" onClick={() => setModal('')}>Vazgeç</Button><Button busy={mutation.busy} onClick={() => mutation.run(async () => { await api(`/products/${id}/archive?archived=${!product.archived}`, { method: 'POST' }); saved() })}>{product.archived ? 'Aktifleştir' : 'Arşivlemeyi onayla'}</Button></div></Modal>}
  </div>
}
