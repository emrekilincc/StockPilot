let csrfToken = ''
let demoMode = typeof localStorage === 'undefined' || localStorage.getItem('stockpilot-demo-mode') !== 'false'
export const setCsrf = (token) => { csrfToken = token || '' }
export const setDemoMode = (enabled) => { demoMode = Boolean(enabled) }

export async function api(path, { method = 'GET', body, signal } = {}) {
  const headers = {}
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') headers['X-CSRF-Token'] = csrfToken
  headers['X-Demo-Mode'] = String(demoMode)
  let response
  try {
    response = await fetch(`/api${path}`, {
      method, credentials: 'include', headers, signal,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Sunucuya ulaşılamıyor. Backend bağlantısını kontrol edin.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('session-expired'))
    const error = new Error(data.error?.message || 'İşlem tamamlanamadı. Lütfen tekrar deneyin.')
    error.status = response.status
    error.fields = data.error?.details
    throw error
  }
  return data
}

export function queryString(values) {
  return new URLSearchParams(Object.entries(values).filter(([, value]) => value !== '' && value !== null && value !== undefined)).toString()
}
