export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_BACKEND_URL

  if (configured) {
    return configured.replace(/\/$/, '')
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:4000'
  }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:4000'
  }

  return window.location.origin
}

export function getApiUrl(path = '') {
  const baseUrl = getApiBaseUrl()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}/api${normalizedPath}`
}
