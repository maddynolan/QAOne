import { create } from 'zustand'

interface User {
  id: number
  email: string
  username: string
  full_name: string | null
  is_admin: boolean
  created_at: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: User) => void
  logout: () => void
  setUser: (user: User) => void
  init: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  login: (token: string, user: User) => {
    set({ token, user, isAuthenticated: true })
    localStorage.setItem('token', token)
  },
  logout: () => {
    set({ token: null, user: null, isAuthenticated: false })
    localStorage.removeItem('token')
  },
  setUser: (user: User) => set({ user }),
  init: async () => {
    const token = localStorage.getItem('token')
    if (token) {
      try {
        // Try to fetch user info to verify token
        const response = await fetch('http://localhost:8002/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.ok) {
          const user = await response.json()
          set({ token, user, isAuthenticated: true })
        } else {
          localStorage.removeItem('token')
          set({ token: null, user: null, isAuthenticated: false })
        }
      } catch (error) {
        localStorage.removeItem('token')
        set({ token: null, user: null, isAuthenticated: false })
      }
    }
  },
}))

