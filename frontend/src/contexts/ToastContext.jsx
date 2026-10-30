/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle2, X, AlertCircle } from 'lucide-react'

const ToastContext = createContext(null)
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  function toast(message, type = 'success') {
    const id = crypto.randomUUID()
    setToasts((old) => [...old.slice(-3), { id, message, type }])
    timers.current.push(setTimeout(() => setToasts((old) => old.filter((t) => t.id !== id)), 5000))
  }
  return <ToastContext.Provider value={toast}>
    {children}
    <div className="toast-stack" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast ${t.type}`} role="status">
      {t.type === 'success' ? <CheckCircle2 size={19} /> : <AlertCircle size={19} />}<span>{t.message}</span>
      <button className="icon-button" aria-label="Bildirimi kapat" onClick={() => setToasts((old) => old.filter((x) => x.id !== t.id))}><X size={16} /></button>
    </div>)}</div>
  </ToastContext.Provider>
}
