import { useState } from 'react'
import { LayoutGrid, Pencil, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useResource } from '../hooks/useResource'
import { useMutation } from '../hooks/useMutation'
import { api } from '../services/api'
import { Button, Empty, ErrorMessage, Field, Loading, Modal, PageHeader } from '../components/ui'

export default function Categories() {
  const { data, loading, error, reload } = useResource('/categories')
  const { can } = useAuth()
  const [editing, setEditing] = useState(null)
  const mutation = useMutation()
  function submit(event) {
    event.preventDefault()
    const body = Object.fromEntries(new FormData(event.currentTarget))
    mutation.run(async () => { await api(editing.id ? `/categories/${editing.id}` : '/categories', { method: editing.id ? 'PATCH' : 'POST', body }); setEditing(null); reload() })
  }
  return <div className="page-enter"><PageHeader title="Kategoriler" subtitle="Düzenli bir katalog, daha kolay bir iş akışı.">{can('products') && <Button onClick={() => setEditing({})}><Plus size={17} />Yeni kategori</Button>}</PageHeader>{error ? <ErrorMessage message={error} retry={reload} /> : loading ? <Loading /> : !data?.length ? <div className="panel"><Empty title="İlk kategorinizi oluşturun" description="Ürün eklemeden önce kataloğunuzu kategorilerle düzenleyin." /></div> : <div className="category-grid">{data.map((category, index) => <article className="panel category-card" key={category.id}><div className="category-card-top"><span className={`category-icon color-${index % 4}`}><LayoutGrid size={23} /></span>{can('products') && <button className="icon-button" aria-label={`${category.name} düzenle`} onClick={() => setEditing(category)}><Pencil size={17} /></button>}</div><h2><Link to={`/products?category_id=${category.id}`}>{category.name}</Link></h2><p>{category.description || 'Bu kategori için açıklama eklenmemiş.'}</p><Link to={`/products?category_id=${category.id}`} className="category-count">{category.product_count} ürün <span>Ürünleri gör →</span></Link></article>)}</div>}
    {editing && <Modal title={editing.id ? 'Kategoriyi düzenle' : 'Yeni kategori'} onClose={() => setEditing(null)}><form onSubmit={submit}><Field label="Kategori adı"><input name="name" required minLength={2} maxLength={100} defaultValue={editing.name} /></Field><Field label="Açıklama"><textarea name="description" rows={3} maxLength={1000} defaultValue={editing.description} /></Field><ErrorMessage message={mutation.error} /><div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Vazgeç</Button><Button type="submit" busy={mutation.busy}>Kategoriyi kaydet</Button></div></form></Modal>}
  </div>
}
