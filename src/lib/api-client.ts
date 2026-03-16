/**
 * Centralized API Client
 *
 * Provides an Axios instance with:
 * - JWT Authorization header on every request
 * - X-Project-ID header from current project context
 * - X-Tenant-ID header from current org context
 * - 401 response interceptor → refresh token → retry
 * - Automatic token storage/retrieval from localStorage
 *
 * Usage:
 *   import { apiClient } from '@/lib/api-client'
 *   const response = await apiClient.get('/test-cases')
 *   const data = await apiClient.post('/api/auth/login', { email, password })
 */

import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig, AxiosError } from 'axios'
import { API_BASE_URL } from './api-config'

// ==================== Token Storage ====================

const TOKEN_KEY = 'flowstral_jwt_token'
const REFRESH_TOKEN_KEY = 'flowstral_refresh_token'
const SESSION_KEY = 'flowstral_session'

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    console.warn('[api-client] Failed to store token in localStorage')
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // Ignore
  }
}

export function getStoredSession(): any | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setStoredSession(session: any): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    console.warn('[api-client] Failed to store session in localStorage')
  }
}

// ==================== Project/Org Context ====================

// These are set by AuthContext when the user switches org/project
let _currentProjectId: string | null = null
let _currentOrgId: string | null = null

export function setCurrentProjectId(projectId: string | null): void {
  _currentProjectId = projectId
}

export function setCurrentOrgId(orgId: string | null): void {
  _currentOrgId = orgId
}

export function getCurrentProjectId(): string | null {
  return _currentProjectId
}

export function getCurrentOrgId(): string | null {
  return _currentOrgId
}

// ==================== Axios Instance ====================

let _isRefreshing = false
let _refreshSubscribers: Array<(token: string) => void> = []

function onTokenRefreshed(token: string) {
  _refreshSubscribers.forEach(callback => callback(token))
  _refreshSubscribers = []
}

function addRefreshSubscriber(callback: (token: string) => void) {
  _refreshSubscribers.push(callback)
}

/**
 * Create the centralized Axios instance
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60s default
  headers: {
    'Content-Type': 'application/json',
  },
})

// ==================== Request Interceptor ====================

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Attach JWT token
    const token = getStoredToken()
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Attach project context
    if (_currentProjectId && config.headers) {
      config.headers['X-Project-ID'] = _currentProjectId
    }

    // Attach org/tenant context
    if (_currentOrgId && config.headers) {
      config.headers['X-Tenant-ID'] = _currentOrgId
    }

    return config
  },
  (error) => Promise.reject(error)
)

// ==================== Response Interceptor ====================

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Skip auth refresh for auth endpoints or already retried requests
    if (
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.url?.includes('/api/auth/login') ||
      originalRequest.url?.includes('/api/auth/signup') ||
      originalRequest.url?.includes('/api/auth/refresh')
    ) {
      return Promise.reject(error)
    }

    // On 401, try to refresh the token
    if (error.response?.status === 401) {
      if (_isRefreshing) {
        // Another request is already refreshing — wait for it
        return new Promise((resolve) => {
          addRefreshSubscriber((newToken: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
            }
            originalRequest._retry = true
            resolve(apiClient(originalRequest))
          })
        })
      }

      _isRefreshing = true

      try {
        const currentToken = getStoredToken()
        if (!currentToken) {
          throw new Error('No token to refresh')
        }

        const refreshResponse = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          { token: currentToken },
          { headers: { 'Content-Type': 'application/json' } }
        )

        const newToken = refreshResponse.data.token
        if (newToken) {
          setStoredToken(newToken)
          onTokenRefreshed(newToken)

          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`
          }
          originalRequest._retry = true
          return apiClient(originalRequest)
        }
      } catch (refreshError) {
        // Refresh failed — clear auth state and redirect to login
        clearStoredToken()
        _refreshSubscribers = []

        // Emit auth-expired event for AuthContext to handle
        window.dispatchEvent(new CustomEvent('auth:expired'))

        return Promise.reject(refreshError)
      } finally {
        _isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export { apiClient }
export default apiClient
