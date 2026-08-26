import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState('')
  const { login, isAuthenticated, error, clearError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = location.state?.from?.pathname || '/dashboard'

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, from])

  useEffect(() => {
    if (error) setLocalError(error)
  }, [error])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError('')
    clearError()
    if (!email.trim() || !password.trim()) {
      setLocalError('Please enter both email and password.')
      return
    }
    setSubmitting(true)
    const result = await login(email.trim(), password)
    setSubmitting(false)
    if (result.success) {
      navigate(from, { replace: true })
    }
  }

  const fillDemo = (role) => {
    const creds = {
      manager: { email: 'manager@foodchain.ai', password: 'password123' },
      warehouse: { email: 'warehouse@foodchain.ai', password: 'password123' },
      viewer: { email: 'viewer@foodchain.ai', password: 'password123' },
    }
    setEmail(creds[role].email)
    setPassword(creds[role].password)
    setLocalError('')
  }

  return (
    <div className="min-h-screen bg-surface-900 flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-surface-800 via-brand-950 to-surface-900 flex-col justify-between p-10 border-r border-surface-600">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838l-2.727 1.17 1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zm5.99 7.176A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">FoodChain AI</h1>
            <p className="text-xs text-gray-500">Supply Chain Intelligence</p>
          </div>
        </div>

        <div>
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            AI-Powered Supply<br />Chain Optimization
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-8">
            Minimize food wastage, optimize inventory distribution, and improve 
            demand forecasting accuracy across your entire supply chain network.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Nodes Monitored', value: '7+' },
              { label: 'Products Tracked', value: '15+' },
              { label: 'Spoilage Reduction', value: '34%' },
              { label: 'AI Accuracy', value: '~92%' },
            ].map(stat => (
              <div key={stat.label} className="bg-surface-700/50 rounded-xl p-4 border border-surface-600">
                <p className="text-2xl font-bold text-brand-400">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-600">© 2025 FoodChain AI — Part 1: Foundation</p>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838l-2.727 1.17 1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
              </svg>
            </div>
            <span className="text-base font-bold text-white">FoodChain AI</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">Welcome back</h2>
            <p className="text-gray-400 text-sm mt-1">Sign in to your account to continue</p>
          </div>

          {/* Error banner */}
          {localError && (
            <div className="mb-4 p-3.5 bg-red-900/30 border border-red-700/50 rounded-lg flex items-center gap-2.5">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-red-300 text-sm">{localError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="input-field"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field"
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full mt-2 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : 'Sign in'}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-7">
            <p className="text-xs text-gray-500 text-center mb-3">— Quick demo access —</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => fillDemo('manager')}
                className="text-center p-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 rounded-lg transition-colors cursor-pointer"
              >
                <p className="text-xs font-semibold text-purple-400">Manager</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">manager@</p>
              </button>
              <button
                onClick={() => fillDemo('warehouse')}
                className="text-center p-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 rounded-lg transition-colors cursor-pointer"
              >
                <p className="text-xs font-semibold text-blue-400">Warehouse</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">warehouse@</p>
              </button>
              <button
                onClick={() => fillDemo('viewer')}
                className="text-center p-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 rounded-lg transition-colors cursor-pointer"
              >
                <p className="text-xs font-semibold text-gray-400">Viewer</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">viewer@</p>
              </button>
            </div>
            <p className="text-xs text-gray-600 text-center mt-2">All demo passwords: password123</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
