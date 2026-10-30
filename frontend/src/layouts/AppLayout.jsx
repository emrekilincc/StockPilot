import { useEffect, useRef, useState } from 'react'
import { Boxes, ChartNoAxesCombined, ChevronDown, CircleHelp, House, LayoutGrid, LogOut, Menu, Moon, Package, Settings, ShieldCheck, ShoppingBag, Sun, Truck, Users, X } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { initials } from '../utils/format'
import { useResource } from '../hooks/useResource'

const navigation = [
  { path: '/', label: 'Genel bakış', icon: House },
  { path: '/products', label: 'Ürünler', icon: Package },
  { path: '/categories', label: 'Kategoriler', icon: LayoutGrid },
  { path: '/inventory', label: 'Stok hareketleri', icon: Boxes },
  { path: '/orders', label: 'Siparişler', icon: ShoppingBag },
  { path: '/customers', label: 'Müşteriler', icon: Users },
  { path: '/suppliers', label: 'Tedarikçiler', icon: Truck },
  { path: '/reports', label: 'Raporlar', icon: ChartNoAxesCombined, admin: true },
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const sidebarRef = useRef(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('stockpilot-theme') || 'light')
  const { data: settings, reload: reloadSettings } = useResource('/settings')
  useEffect(() => {
    window.addEventListener('settings-updated', reloadSettings)
    return () => window.removeEventListener('settings-updated', reloadSettings)
  }, [reloadSettings])
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('stockpilot-theme', theme) }, [theme])
  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const links = [...sidebarRef.current.querySelectorAll('a, button')].filter((element) => element.getClientRects().length)
    links[0]?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
      if (event.key === 'Tab' && event.shiftKey && document.activeElement === links[0]) { event.preventDefault(); links.at(-1)?.focus() }
      else if (event.key === 'Tab' && !event.shiftKey && document.activeElement === links.at(-1)) { event.preventDefault(); links[0]?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; previous?.focus() }
  }, [open])
  const current = navigation.find((item) => item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path))
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">İçeriğe geç</a>
    {open && <button className="sidebar-backdrop" aria-label="Menüyü kapat" onClick={() => setOpen(false)} />}
    <aside ref={sidebarRef} className={`sidebar ${open ? 'open' : ''}`} aria-label="Ana menü" role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined}>
      <Link to="/" className="brand"><span className="brand-symbol"><Package size={24} /></span>StockPilot<span className="brand-dot">.</span></Link>
      <button className="mobile-close icon-button" onClick={() => setOpen(false)} aria-label="Menüyü kapat"><X size={20} /></button>
      <Link to="/settings" className="workspace-card"><span className="workspace-avatar">{initials(settings?.company_name || 'StockPilot')}</span><span><strong>{settings?.company_name || 'StockPilot'}</strong><small>Çalışma alanı</small></span><ChevronDown size={15} /></Link>
      <span className="nav-caption">ÇALIŞMA ALANI</span>
      <nav>{navigation.filter((item) => !item.admin || user.role === 'admin').map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} end={path === '/'}><Icon size={19} strokeWidth={1.8} /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><span className="nav-caption">YÖNETİM</span><nav>
        {user.role === 'admin' && <NavLink to="/users"><ShieldCheck size={19} />Kullanıcılar</NavLink>}
        <NavLink to="/settings"><Settings size={19} />Ayarlar</NavLink>
      </nav><div className="local-card"><span className="live-dot" /><div><strong>Verileriniz sizinle.</strong><p>Yerel ve güvenli çalışma alanı</p></div></div>
      <div className="sidebar-user"><Link to="/settings" className="user-link"><span className="avatar">{initials(user.name)}</span><span><strong>{user.name}</strong><small>{user.role === 'admin' ? 'Yönetici' : 'Çalışan'}</small></span></Link><button className="icon-button" aria-label="Çıkış yap" onClick={async () => { try { await logout() } catch (e) { toast(e.message, 'error') } }}><LogOut size={17} /></button></div></div>
    </aside>
    <div className="main-shell" inert={open}><header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="Menüyü aç" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={21} /></button><span className="breadcrumb-root">Çalışma alanı</span><span className="breadcrumb-divider">/</span><strong>{current?.label || (location.pathname.startsWith('/users') ? 'Kullanıcılar' : 'Ayarlar')}</strong></div><div className="topbar-actions"><span className="today">{new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</span><button className="icon-button" aria-label={theme === 'light' ? 'Koyu temaya geç' : 'Açık temaya geç'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button><Link to="/settings" className="avatar small" aria-label="Profilim">{initials(user.name)}</Link></div></header>
      <main id="main-content" className="page-container" tabIndex={-1}><Outlet /></main>
      <footer className="app-footer"><span>StockPilot <span>© {new Date().getFullYear()}</span></span><span>İşinize odaklanın. Kontrol sizde.</span></footer>
    </div>
  </div>
}
