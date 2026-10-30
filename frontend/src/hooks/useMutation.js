import { useState } from 'react'
import { useToast } from '../contexts/ToastContext'

export function useMutation() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()
  async function run(action, message = 'Değişiklikler kaydedildi.') {
    if (busy) return
    setBusy(true); setError('')
    try { await action(); if (message) toast(message) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return { busy, error, run }
}
