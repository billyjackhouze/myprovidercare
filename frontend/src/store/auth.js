import { create } from 'zustand'
import api from '@/lib/api'

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('ncm_token'),
  isAuthenticated: !!localStorage.getItem('ncm_token'),
  permissions: [],   // effective permission keys for the current user

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const { access_token, role, full_name } = res.data
    localStorage.setItem('ncm_token', access_token)
    set({ token: access_token, isAuthenticated: true, user: { email, role, full_name }, permissions: [] })
    return res.data
  },

  logout: () => {
    localStorage.removeItem('ncm_token')
    set({ token: null, isAuthenticated: false, user: null, permissions: [] })
  },

  fetchMe: async () => {
    try {
      const meRes = await api.get('/users/me')
      set({ user: meRes.data })
      // Load permissions separately — never allow this to break auth
      try {
        const permRes = await api.get('/settings/me/permissions')
        set({ permissions: permRes.data.permissions || [] })
      } catch {
        // Permissions unavailable — silently fall back to showing all nav items
        set({ permissions: [] })
      }
    } catch {
      localStorage.removeItem('ncm_token')
      set({ token: null, isAuthenticated: false, user: null, permissions: [] })
    }
  },
}))

export default useAuthStore
