import { useState } from 'react'
import { Building2, LockKeyhole, Save, UserRound } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useResource } from '../hooks/useResource'
import { useMutation } from '../hooks/useMutation'
import { api } from '../services/api'
import { Button, ErrorMessage, Field, Loading, PageHeader, SectionTitle } from '../components/ui'

function ProfileSettings() {
  const { user, setUser } = useAuth()
  const mutation = useMutation()
  function submit(event) {
    event.preventDefault()
    const body = Object.fromEntries(new FormData(event.currentTarget))
    mutation.run(async () => setUser(await api('/auth/profile', { method: 'PATCH', body })), 'Profiliniz güncellendi.')
  }
  return <section className="panel settings-panel"><SectionTitle title="Profil bilgileri" subtitle="Hesabınızdaki ad ve iletişim bilgilerini güncelleyin." /><form onSubmit={submit}><div className="form-grid"><Field label="Ad soyad"><input name="name" required minLength={2} maxLength={120} defaultValue={user.name} /></Field><Field label="E-posta adresi"><input name="email" required type="email" defaultValue={user.email} /></Field></div><p className="form-hint">Rolünüz: {user.role === 'admin' ? 'Yönetici' : 'Çalışan'}. Yetkiler yönetici tarafından belirlenir.</p><ErrorMessage message={mutation.error} /><Button type="submit" busy={mutation.busy}><Save size={16} />Profili kaydet</Button></form></section>
}

function PasswordSettings() {
  const { refresh } = useAuth()
  const mutation = useMutation()
  function submit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const confirmation = form.elements.confirm
    if (data.get('new_password') !== data.get('confirm')) { confirmation.setCustomValidity('Yeni parolalar eşleşmiyor.'); confirmation.reportValidity(); return }
    mutation.run(async () => { await api('/auth/password', { method: 'POST', body: { current_password: data.get('current_password'), new_password: data.get('new_password') } }); await refresh() }, 'Parola değişti. Yeni parolanızla giriş yapın.')
  }
  return <section className="panel settings-panel"><SectionTitle title="Parola ve güvenlik" subtitle="Parola değişikliğinde tüm cihazlardaki oturumlar kapatılır." /><form onSubmit={submit}><Field label="Mevcut parola"><input name="current_password" type="password" autoComplete="current-password" required maxLength={128} /></Field><div className="form-grid"><Field label="Yeni parola" hint="En az 12 karakter."><input name="new_password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></Field><Field label="Yeni parola tekrar"><input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} onInput={(e) => e.target.setCustomValidity('')} /></Field></div><ErrorMessage message={mutation.error} /><Button type="submit" busy={mutation.busy}>Parolayı değiştir</Button></form></section>
}

function CompanySettings() {
  const { data, loading, error, reload } = useResource('/settings')
  const mutation = useMutation()
  if (loading) return <Loading />
  if (error) return <ErrorMessage message={error} retry={reload} />
  function submit(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    mutation.run(async () => { await api('/settings', { method: 'PATCH', body: { company_name: data.get('company_name'), registration_enabled: data.get('registration_enabled') === 'on' } }); reload(); window.dispatchEvent(new Event('settings-updated')) })
  }
  return <section className="panel settings-panel"><SectionTitle title="Çalışma alanı ayarları" subtitle="İşletme bilgileri ve yeni kullanıcı başvuruları." /><form onSubmit={submit}><Field label="İşletme adı"><input name="company_name" required minLength={2} maxLength={120} defaultValue={data.company_name} /></Field><label className="switch-row"><div><strong>Hesap başvurularına izin ver</strong><p>Yeni hesaplar çalışan rolünde, yönetici onayı bekleyerek oluşturulur.</p></div><input type="checkbox" name="registration_enabled" role="switch" defaultChecked={data.registration_enabled} /></label><ErrorMessage message={mutation.error} /><Button type="submit" busy={mutation.busy}><Save size={16} />Ayarları kaydet</Button></form></section>
}

export default function Settings() {
  const [tab, setTab] = useState('profile')
  const { user } = useAuth()
  const tabs = [{ id: 'profile', label: 'Profilim', icon: UserRound }, { id: 'password', label: 'Güvenlik', icon: LockKeyhole }, ...(user.role === 'admin' ? [{ id: 'company', label: 'Çalışma alanı', icon: Building2 }] : [])]
  return <div className="page-enter"><PageHeader title="Ayarlar" subtitle="Çalışma alanınızı ve hesabınızı kendinize göre düzenleyin." /><div className="settings-tabs">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={17} />{label}</button>)}</div>{tab === 'profile' ? <ProfileSettings /> : tab === 'password' ? <PasswordSettings /> : <CompanySettings />}</div>
}
