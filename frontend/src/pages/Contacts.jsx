import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Mail, MapPin, Pencil, Phone, Plus, Truck, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useResource, useDebounce } from '../hooks/useResource'
import { useMutation } from '../hooks/useMutation'
import { api, queryString } from '../services/api'
import { Badge, Button, ErrorMessage, Field, Loading, Modal, PageHeader, Pagination, SearchInput, SectionTitle, Table } from '../components/ui'
import { OrderTable } from './Orders'
import { date, initials, money } from '../utils/format'

function ContactForm({ kind, contact, onSaved, onClose }) {
  const { busy, error, run } = useMutation()
  const label = kind === 'customers' ? 'müşteri' : 'tedarikçi'
  function submit(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const body = { ...Object.fromEntries(data), active: data.get('active') === 'on' }
    run(async () => { const result = await api(`/${kind}${contact?.id ? `/${contact.id}` : ''}`, { method: contact?.id ? 'PATCH' : 'POST', body }); onSaved(result) })
  }
  return <Modal title={contact?.id ? `${label === 'müşteri' ? 'Müşteriyi' : 'Tedarikçiyi'} düzenle` : `Yeni ${label}`} onClose={() => !busy && onClose()}><form onSubmit={submit}>
    <Field label="Ad / Firma adı"><input name="name" required minLength={2} maxLength={120} defaultValue={contact?.name} /></Field><div className="form-grid"><Field label="E-posta"><input name="email" type="email" maxLength={254} defaultValue={contact?.email} /></Field><Field label="Telefon"><input name="phone" type="tel" maxLength={40} defaultValue={contact?.phone} /></Field></div><Field label="Adres"><textarea name="address" rows={3} maxLength={1000} defaultValue={contact?.address} /></Field><label className="checkbox-field"><input name="active" type="checkbox" defaultChecked={contact?.active ?? true} />Aktif kayıt</label><ErrorMessage message={error} /><div className="modal-actions"><Button type="button" variant="secondary" disabled={busy} onClick={onClose}>Vazgeç</Button><Button type="submit" busy={busy}>Kaydet</Button></div>
  </form></Modal>
}

export default function Contacts({ kind }) {
  const isCustomer = kind === 'customers'
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [active, setActive] = useState('')
  const [editing, setEditing] = useState(null)
  const q = useDebounce(search)
  const { can } = useAuth()
  const { data, loading, error, reload } = useResource(`/${kind}?${queryString({ page, q, active })}`)
  return <div className="page-enter"><PageHeader title={isCustomer ? 'Müşteriler' : 'Tedarikçiler'} subtitle={isCustomer ? 'Güçlü ilişkiler, düzenli kayıtlarla başlar.' : 'Tedarik ağınızı ve iş ortaklarınızı tek yerden yönetin.'}>{can(isCustomer ? 'orders' : 'products') && <Button onClick={() => setEditing({})}><Plus size={17} />Yeni {isCustomer ? 'müşteri' : 'tedarikçi'}</Button>}</PageHeader><div className="panel"><div className="toolbar"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Ad, e-posta veya telefon ara…" /><select aria-label="Aktiflik filtresi" value={active} onChange={(e) => { setActive(e.target.value); setPage(1) }}><option value="">Tüm kayıtlar</option><option value="true">Aktif</option><option value="false">Pasif</option></select></div>{error ? <ErrorMessage message={error} retry={reload} /> : loading ? <Loading /> : <><Table rows={data?.items} columns={[
    { key: 'name', label: isCustomer ? 'MÜŞTERİ' : 'TEDARİKÇİ', render: (r) => <Link to={`/${kind}/${r.id}`} className="contact-cell"><span className="contact-avatar">{initials(r.name)}</span><strong>{r.name}</strong></Link> },
    { key: 'email', label: 'E-POSTA', render: (r) => r.email || '—' }, { key: 'phone', label: 'TELEFON', render: (r) => r.phone || '—' },
    { key: 'active', label: 'DURUM', render: (r) => <Badge tone={r.active ? 'success' : 'neutral'}>{r.active ? 'Aktif' : 'Pasif'}</Badge> },
    { key: 'created_at', label: 'KAYIT TARİHİ', render: (r) => date(r.created_at) },
    { key: 'action', label: '', render: (r) => can(isCustomer ? 'orders' : 'products') && <button className="icon-button" aria-label={`${r.name} düzenle`} onClick={() => setEditing(r)}><Pencil size={17} /></button> },
  ]} /><Pagination data={data} onPage={setPage} /></>}</div>{editing && <ContactForm key={editing.id || 'new'} kind={kind} contact={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}</div>
}

export function ContactDetail({ kind }) {
  const { id } = useParams()
  const isCustomer = kind === 'customers'
  const { can } = useAuth()
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(false)
  const { data: contact, loading, error, reload } = useResource(`/${kind}/${id}`)
  const related = useResource(isCustomer ? `/orders?customer_id=${id}&page=${page}` : `/products?supplier_id=${id}&page=${page}`)
  if (loading) return <Loading />
  if (error) return <ErrorMessage message={error} retry={reload} />
  return <div className="page-enter"><PageHeader title={contact.name} subtitle={isCustomer ? 'Müşteri bilgileri ve sipariş geçmişi' : 'Tedarikçi bilgileri ve aktif ürünleri'} back={`/${kind}`}>{can(isCustomer ? 'orders' : 'products') && <Button variant="secondary" onClick={() => setEditing(true)}><Pencil size={16} />Düzenle</Button>}</PageHeader><div className="contact-overview panel"><span className="contact-avatar large">{initials(contact.name)}</span><div><Badge tone={contact.active ? 'success' : 'neutral'}>{contact.active ? 'Aktif' : 'Pasif'}</Badge><p><Mail size={16} />{contact.email || 'E-posta belirtilmedi'}</p><p><Phone size={16} />{contact.phone || 'Telefon belirtilmedi'}</p><p><MapPin size={16} />{contact.address || 'Adres belirtilmedi'}</p></div><span className="muted">Kayıt: {date(contact.created_at)}</span></div><section className="panel"><SectionTitle title={isCustomer ? 'Sipariş geçmişi' : 'Bağlı ürünler'} />{related.error ? <ErrorMessage message={related.error} retry={related.reload} /> : related.loading ? <Loading /> : <>{isCustomer ? <OrderTable rows={related.data?.items} /> : <Table rows={related.data?.items} columns={[
    { key: 'name', label: 'ÜRÜN', render: (r) => <Link to={`/products/${r.id}`} className="table-link">{r.name}</Link> }, { key: 'sku', label: 'SKU' }, { key: 'stock', label: 'STOK' }, { key: 'sale_price', label: 'SATIŞ FİYATI', render: (r) => money(r.sale_price) },
  ]} />}<Pagination data={related.data} onPage={setPage} /></>}</section>{editing && <ContactForm kind={kind} contact={contact} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload() }} />}</div>
}
