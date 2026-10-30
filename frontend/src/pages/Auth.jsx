import { useState } from 'react'
import { ArrowRight, Check, Layers3, Package, ShieldCheck } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { Button, ErrorMessage, Field } from '../components/ui'

export default function Auth({ register = false }) {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  if (user) return <Navigate to="/" replace />
  async function submit(event) {
    event.preventDefault()
    const body = Object.fromEntries(new FormData(event.currentTarget))
    setBusy(true); setError('')
    try {
      if (register) { const data = await api('/auth/register', { method: 'POST', body }); setSuccess(data.message) }
      else { await login(body); navigate('/') }
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <div className="auth-page"><section className="auth-story"><Link to="/login" className="brand"><span className="brand-symbol"><Package size={24} /></span>StockPilot.</Link><div className="auth-story-content"><span className="eyebrow">DAHA DÜZENLİ BİR İŞ GÜNÜ</span><h1>Her ürün yerinde.<br />Her sipariş<br /><em>kontrolünüzde.</em></h1><p>Stoğunuzdan satışlarınıza, işletmenizin tüm hareketlerini tek bir çalışma alanında yönetin.</p><div className="auth-illustration"><div className="illustration-box box-back"><Layers3 size={62} strokeWidth={1} /></div><div className="illustration-box box-front"><Package size={80} strokeWidth={1} /></div><span className="illustration-check"><Check size={23} /></span><div className="illustration-label"><span className="live-dot" />Birbirine bağlı operasyonlar</div></div></div><div className="auth-story-footer"><ShieldCheck size={17} />Verileriniz kendi bilgisayarınızda, kontrol sizde.</div></section>
    <section className="auth-form-side"><div className="auth-form"><span className="auth-mini-logo"><Package size={25} /></span><h2>{register ? 'Ekibinize katılın' : 'Tekrar hoş geldiniz'}</h2><p>{register ? 'Bir hesap başvurusu oluşturun. Yönetici onayından sonra giriş yapabilirsiniz.' : 'Çalışma alanınıza devam etmek için giriş yapın.'}</p>
      {success ? <div className="success-panel" role="status"><Check size={25} /><p>{success}</p><Link className="button primary" to="/login">Giriş sayfasına dön</Link></div> : <form onSubmit={submit}>
        {register && <Field label="Ad soyad"><input name="name" autoComplete="name" required minLength={2} maxLength={120} placeholder="Adınız ve soyadınız" /></Field>}
        <Field label="E-posta adresi"><input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="ornek@sirket.com" /></Field>
        <Field label="Parola" hint={register ? 'En az 12 karakter kullanın.' : undefined}><input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 12 : 1} maxLength={128} placeholder="Parolanızı girin" /></Field>
        <ErrorMessage message={error} /><Button busy={busy} type="submit" className="full-width">{register ? 'Hesap başvurusu oluştur' : 'Giriş yap'}<ArrowRight size={17} /></Button>
      </form>}
      <p className="auth-switch">{register ? 'Zaten hesabınız var mı?' : 'Ekibinize yeni mi katıldınız?'} <Link to={register ? '/login' : '/register'}>{register ? 'Giriş yapın' : 'Hesap oluşturun'}</Link></p>
      {!register && <div className="auth-note"><ShieldCheck size={18} /><span>İlk kez mi kuruyorsunuz? Yönetici hesabınızı kurulum kılavuzundaki güvenli komutla oluşturun.</span></div>}
    </div><span className="auth-copyright">StockPilot · İşletmenizin yeni çalışma düzeni</span></section>
  </div>
}
