import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export function useResource(path) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  useEffect(() => {
    if (!path) { setState({ data: null, loading: false, error: '' }); return }
    const controller = new AbortController()
    setState((old) => ({ ...old, loading: true, error: '' }))
    api(path, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setState({ data, loading: false, error: '' })
    }).catch((error) => {
      if (error.name !== 'AbortError') setState({ data: null, loading: false, error: error.message })
    })
    return () => controller.abort()
  }, [path, version])
  return { ...state, reload }
}

export function useDebounce(value, delay = 250) {
  const [result, setResult] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setResult(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return result
}
