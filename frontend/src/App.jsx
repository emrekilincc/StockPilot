import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { Empty, Loading } from './components/ui'
import AppLayout from './layouts/AppLayout'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Categories from './pages/Categories'
import Inventory from './pages/Inventory'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Contacts, { ContactDetail } from './pages/Contacts'
import Reports from './pages/Reports'
import Users from './pages/Users'
import Settings from './pages/Settings'
import { Link } from 'react-router-dom'

function Protected({ admin = false, children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="initial-loading"><Loading rows={3} /></div>
  if (!user) return <Navigate to="/login" replace />
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<Auth />} />
    <Route path="/register" element={<Auth register />} />
    <Route element={<Protected><AppLayout /></Protected>}>
      <Route index element={<Dashboard />} />
      <Route path="products" element={<Products />} />
      <Route path="products/:id" element={<ProductDetail />} />
      <Route path="categories" element={<Categories />} />
      <Route path="inventory" element={<Inventory />} />
      <Route path="orders" element={<Orders />} />
      <Route path="orders/:id" element={<OrderDetail />} />
      <Route path="customers" element={<Contacts key="customers" kind="customers" />} />
      <Route path="customers/:id" element={<ContactDetail key="customers" kind="customers" />} />
      <Route path="suppliers" element={<Contacts key="suppliers" kind="suppliers" />} />
      <Route path="suppliers/:id" element={<ContactDetail key="suppliers" kind="suppliers" />} />
      <Route path="reports" element={<Protected admin><Reports /></Protected>} />
      <Route path="users" element={<Protected admin><Users /></Protected>} />
      <Route path="settings" element={<Settings />} />
      <Route path="*" element={<div className="panel"><Empty title="Bu sayfayı bulamadık" description="Adres değişmiş veya sayfa kaldırılmış olabilir."><Link className="button primary" to="/">Genel bakışa dön</Link></Empty></div>} />
    </Route>
  </Routes>
}
