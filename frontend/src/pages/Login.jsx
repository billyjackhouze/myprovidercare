import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconEye, IconEyeOff, IconLoader2 } from '@tabler/icons-react'
import toast from 'react-hot-toast'
import useAuthStore from '@/store/auth'

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Logo card */}
        <div className="bg-white rounded-card border border-border p-8 shadow-sm">
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-card mb-3"
              style={{ background: '#1B2D4E' }}
            >
              <span className="text-white text-xs font-bold">NCM</span>
            </div>
            <h1 className="text-lg font-semibold text-heading">NationalCM</h1>
            <p className="text-muted text-xs mt-0.5">Case Management Platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label">Email</label>
              <input
                type="email"
                className="field-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="field-input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-heading"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <IconLoader2 size={16} className="animate-spin" /> : null}
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
