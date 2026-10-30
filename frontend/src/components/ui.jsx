import { cloneElement, useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Inbox, Loader2, Package, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDebounce, useResource } from '../hooks/useResource'
import { queryString } from '../services/api'
import { statuses } from '../utils/format'

export function Button({ children, variant = 'primary', className = '', busy, ...props }) {
  return <button {...props} disabled={props.disabled || busy} className={`button ${variant} ${className}`}>
    {busy && <Loader2 size={16} className="spin" />}{children}
  </button>
}

export function PageHeader({ title, subtitle, children, back }) {
  return <div className="page-header"><div>{back && <Link to={back} className="back-link"><ArrowLeft size={15} /> Geri dön</Link>}<h1>{title}</h1><p>{subtitle}</p></div><div className="page-actions">{children}</div></div>
}

export function Field({ label, children, hint, className = '' }) {
  const id = useId()
  return <div className={`field ${className}`}><label htmlFor={id}>{label}</label>{cloneElement(children, { id, ...(hint ? { 'aria-describedby': `${id}-hint` } : {}) })}{hint && <small id={`${id}-hint`}>{hint}</small>}</div>
}

export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = previous }
  }, [])
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === ref.current) onClose() }}>
    <div className="modal-body"><div className="modal-header"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="Pencereyi kapat" onClick={onClose}><X size={20} /></button></div>{children}</div>
  </dialog>
}

export function ErrorMessage({ message, retry }) {
  if (!message) return null
  return <div className="error-message" role="alert"><AlertCircle size={18} /><span>{message}</span>{retry && <button onClick={retry}>Tekrar dene</button>}</div>
}

export function Loading({ rows = 4 }) {
  return <div className="skeleton-list" role="status" aria-label="Yükleniyor">{Array.from({ length: rows }, (_, index) => <div className="skeleton" key={index} />)}<span className="sr-only">Veriler yükleniyor…</span></div>
}

export function Empty({ title = 'Henüz kayıt yok', description = 'Yeni bir kayıt eklediğinizde burada görünecek.', children }) {
  return <div className="empty"><span className="empty-icon"><Inbox size={27} /></span><h3>{title}</h3><p>{description}</p>{children}</div>
}

export function Badge({ status, children, tone = '' }) {
  return <span className={`badge ${tone || status || ''}`}><i />{children || statuses[status] || status}</span>
}

export function ProductAvatar({ product, large = false }) {
  return <span className={`product-avatar ${large ? 'large' : ''}`}>{product.image ? <img src={product.image} alt={product.name} /> : <Package size={large ? 64 : 21} strokeWidth={1.6} />}</span>
}

export function Table({ columns, rows, rowKey = 'id', empty }) {
  if (!rows?.length) return empty || <Empty />
  return <div className="table-scroll"><table><thead><tr>{columns.map((c) => <th key={c.key} scope="col" className={c.className}>{c.label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={row[rowKey] ?? i}>{columns.map((c) => <td key={c.key} className={c.className}>{c.render ? c.render(row) : row[c.key]}</td>)}</tr>)}</tbody></table></div>
}

export function Pagination({ data, onPage }) {
  if (!data || !data.total) return null
  const pages = Math.ceil(data.total / data.page_size)
  return <div className="pagination"><span>Toplam <strong>{data.total}</strong> kayıt · Sayfa {data.page} / {pages}</span><div>
    <button className="icon-button" aria-label="Önceki sayfa" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}><ChevronLeft size={18} /></button>
    <button className="icon-button" aria-label="Sonraki sayfa" disabled={data.page >= pages} onClick={() => onPage(data.page + 1)}><ChevronRight size={18} /></button>
  </div></div>
}

export function SearchInput({ value, onChange, placeholder = 'Kayıtlarda ara…' }) {
  return <div className="search-input"><Search size={17} /><input type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} /></div>
}

export function SectionTitle({ title, subtitle, to, linkText = 'Tümünü gör' }) {
  return <div className="section-title"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{to && <Link to={to}>{linkText} <ArrowRight size={15} /></Link>}</div>
}

// Searchable, paginated native controls keep large catalogs usable without loading every row.
export function EntityPicker({ endpoint, label, value, onChange, initialLabel = '', extra = {} }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [selectedName, setSelectedName] = useState(initialLabel)
  const debounced = useDebounce(search)
  const { data, loading, error } = useResource(open ? `/${endpoint}?${queryString({ ...extra, q: debounced, page, page_size: 8 })}` : null)
  return <div className="entity-picker"><span className="picker-label">{label}</span>
    <button type="button" className="picker-trigger" onClick={() => setOpen(!open)} aria-expanded={open}>{value ? selectedName || initialLabel || `Seçili kayıt #${value}` : `${label} seçin`}<Search size={16} /></button>
    {open && <div className="picker-menu"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder={`${label} ara…`} />
      {error && <ErrorMessage message={error} />}{loading ? <Loading rows={2} /> : <div className="picker-results">{data?.items.map((row) => <button type="button" key={row.id} onClick={() => { onChange(row); setSelectedName(row.name); setOpen(false) }}><span>{row.name}<small>{row.sku || row.email}</small></span>{row.id === Number(value) && <Check size={16} />}</button>)}{data?.total === 0 && <p className="muted">Kayıt bulunamadı.</p>}</div>}
      <Pagination data={data} onPage={setPage} />
    </div>}
  </div>
}
