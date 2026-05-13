import { create } from 'zustand'
import api from '@/lib/api'

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('ncm_token'),
  isAuthenticated: !!localStorage.getItem('ncm_token'),

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const { access_token, role, full_name } = res.data
    localStorage.setItem('ncm_token', access_token)
    set({ token: access_token, isAuthenticated: true, user: { email, role, full_name } })
    return res.data
  },

  logout: () => {
    localStorage.removeItem('ncm_token')
    set({ token: null, isAuthenticated: false, user: null })
  },

  fetchMe: async () => {
    try {
      const res = await api.get('/users/me')
      set({ user: res.data })
    } catch {
      // token invalid
      localStorage.removeItem('ncm_token')
      set({ token: null, isAuthenticated: false, user: null })
    }
  },
}))

export default useAuthStore
