import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000, // 60s for Claude Vision calls
})

// Attach JWT from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ncm_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 401 → redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ncm_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
