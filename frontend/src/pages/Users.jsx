import { useState } from 'react'
import { Pencil, ShieldCheck } from 'lucide-react'
import { useResource } from '../hooks/useResource'
import { useMutation } from '../hooks/useMutation'
import { api } from '../services/api'
import { Badge, Button, ErrorMessage, Field, Loading, Modal, PageHeader, Pagination, Table } from '../components/ui'
import { date, initials } from '../utils/format'

export default function Users() {
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const [role, setRole] = useState('employee')
  const { data, loading, error, reload } = useResource(`/users?page=${page}`)
  const mutation = useMutation()
  function submit(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const body = { role: data.get('role'), status: data.get('status'), manage_products: data.get('manage_products') === 'on', manage_stock: data.get('manage_stock') === 'on', manage_orders: data.get('manage_orders') === 'on' }
    mutation.run(async () => { await api(`/users/${editing.id}`, { method: 'PATCH', body }); setEditing(null); reload() }, 'Kullanıcı yetkileri güncellendi. Kullanıcının yeniden giriş yapması gerekiyor.')
  }
  return <div className="page-enter"><PageHeader title="Kullanıcılar" subtitle="Ekibinizin erişimlerini ve bekleyen hesap başvurularını yönetin." /><div className="info-strip"><ShieldCheck size={18} />Yeni kullanıcılar kayıt ekranından başvurur. Aktifleştirmek ve yetki vermek için kaydı düzenleyin.</div><div className="panel">{error ? <ErrorMessage message={error} retry={reload} /> : loading ? <Loading /> : <><Table rows={data?.items} columns={[
    { key: 'name', label: 'KULLANICI', render: (r) => <div className="contact-cell"><span className="avatar">{initials(r.name)}</span><span className="cell-title">{r.name}<small>{r.email}</small></span></div> },
    { key: 'role', label: 'ROL', render: (r) => r.role === 'admin' ? 'Yönetici' : 'Çalışan' },
    { key: 'status', label: 'DURUM', render: (r) => <Badge tone={r.status === 'active' ? 'success' : r.status === 'pending' ? 'warning' : 'neutral'}>{{ active: 'Aktif', pending: 'Onay bekliyor', disabled: 'Devre dışı' }[r.status]}</Badge> },
    { key: 'created_at', label: 'KAYIT TARİHİ', render: (r) => date(r.created_at) },
    { key: 'action', label: '', render: (r) => <button className="button secondary small-button" onClick={() => { setEditing(r); setRole(r.role) }}><Pencil size={14} />Yetkileri düzenle</button> },
  ]} /><Pagination data={data} onPage={setPage} /></>}</div>{editing && <Modal title={`${editing.name} · Yetkiler`} onClose={() => setEditing(null)}><form onSubmit={submit}><div className="form-grid"><Field label="Rol"><select name="role" value={role} onChange={(e) => setRole(e.target.value)}><option value="employee">Çalışan</option><option value="admin">Yönetici</option></select></Field><Field label="Durum"><select name="status" defaultValue={editing.status}><option value="active">Aktif</option><option value="pending">Onay bekliyor</option><option value="disabled">Devre dışı</option></select></Field></div><div className="permissions-box"><h3>Çalışan izinleri</h3>{role === 'admin' && <p className="form-hint">Yönetici tüm işlemleri gerçekleştirebilir.</p>}{[['manage_products', 'Ürün, kategori ve tedarikçi yönetimi'], ['manage_stock', 'Stok giriş, çıkış ve düzeltme'], ['manage_orders', 'Kendi siparişleri ve müşteri yönetimi']].map(([key, label]) => <label className="checkbox-field" key={key}><input type="checkbox" name={key} disabled={role === 'admin'} defaultChecked={editing[key]} />{label}</label>)}</div><ErrorMessage message={mutation.error} /><div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Vazgeç</Button><Button type="submit" busy={mutation.busy}>Yetkileri kaydet</Button></div></form></Modal>}</div>
}
