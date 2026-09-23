import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

/* ─── Google GSI helper ─── */
const initGoogleSignIn = (callback) => {
  if (!window.google || !GOOGLE_CLIENT_ID) return
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback,
    auto_select: false,
    cancel_on_tap_outside: true,
  })
}

/* ─── Inline SVG icons ─── */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" className="flex-shrink-0">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
)

const EyeIcon = ({ open }) => open ? (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
) : (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-4 h-4 text-brand-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

/* ─── Password strength meter ─── */
const getStrength = (pw) => {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 6) s++
  if (pw.length >= 10) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}

const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong']
const strengthColor = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a']

const StrengthBar = ({ password }) => {
  const s = getStrength(password)
  if (!password) return null
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1,2,3,4,5].map(i => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ backgroundColor: i <= s ? strengthColor[s] : '#374151' }}
          />
        ))}
      </div>
      <p className="text-xs" style={{ color: strengthColor[s] }}>{strengthLabel[s]}</p>
    </div>
  )
}

/* ─── Main component ─── */
const LoginPage = () => {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('VIEWER')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [localError, setLocalError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const { login, register, loginWithGoogle, isAuthenticated, error, clearError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const googleBtnRef = useRef(null)

  const from = location.state?.from?.pathname || '/dashboard'

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true })
  }, [isAuthenticated, navigate, from])

  useEffect(() => {
    if (error) setLocalError(error)
  }, [error])

  /* ── Google GSI callback ── */
  const handleGoogleResponse = useCallback(async (response) => {
    setLocalError('')
    clearError()
    setGoogleLoading(true)
    const result = await loginWithGoogle(response.credential)
    setGoogleLoading(false)
    if (result.success) {
      navigate(from, { replace: true })
    }
  }, [loginWithGoogle, navigate, from, clearError])

  /* ── Init Google one-tap on mount ── */
  useEffect(() => {
    const tryInit = () => {
      if (window.google) {
        initGoogleSignIn(handleGoogleResponse)
      }
    }
    tryInit()
    window.addEventListener('google-loaded', tryInit)
    return () => window.removeEventListener('google-loaded', tryInit)
  }, [handleGoogleResponse])

  /* ── Render Google button via GSI ── */
  useEffect(() => {
    if (!window.google || !GOOGLE_CLIENT_ID || !googleBtnRef.current) return
    try {
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        shape: 'rectangular',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        logo_alignment: 'left',
        width: googleBtnRef.current.offsetWidth || 400,
      })
    } catch (e) { /* GSI not ready yet */ }
  }, [mode])

  const clearForm = () => {
    setEmail(''); setPassword(''); setConfirmPassword(''); setName(''); setRole('VIEWER')
    setLocalError(''); setSuccessMsg(''); clearError()
  }

  const switchMode = (m) => { setMode(m); clearForm() }

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError('')
    clearError()

    if (mode === 'signup') {
      if (!name.trim()) return setLocalError('Please enter your full name.')
      if (!email.trim()) return setLocalError('Please enter your email address.')
      if (password.length < 6) return setLocalError('Password must be at least 6 characters.')
      if (password !== confirmPassword) return setLocalError('Passwords do not match.')
      if (!['WAREHOUSE_ADMIN', 'VIEWER'].includes(role)) return setLocalError('Please select a valid role.')

      setSubmitting(true)
      const result = await register(name.trim(), email.trim(), password, role)
      setSubmitting(false)
      if (result.success) {
        navigate(from, { replace: true })
      }
    } else {
      if (!email.trim() || !password.trim()) return setLocalError('Please enter both email and password.')
      setSubmitting(true)
      const result = await login(email.trim(), password)
      setSubmitting(false)
      if (result.success) navigate(from, { replace: true })
    }
  }

  const fillDemo = (role) => {
    const creds = {
      manager:   { email: 'manager@foodchain.ai',   password: 'password123' },
      warehouse: { email: 'warehouse@foodchain.ai',  password: 'password123' },
      viewer:    { email: 'viewer@foodchain.ai',     password: 'password123' },
    }
    setEmail(creds[role].email)
    setPassword(creds[role].password)
    setLocalError('')
  }

  const noGoogleClientId = !GOOGLE_CLIENT_ID

  /* ─────────── JSX ─────────── */
  return (
    <div className="min-h-screen bg-surface-900 flex">

      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-surface-800 via-brand-950 to-surface-900 flex-col justify-between p-10 border-r border-surface-600 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-[-80px] left-[-80px] w-72 h-72 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-60px] right-[-60px] w-60 h-60 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838l-2.727 1.17 1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zm5.99 7.176A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">FoodChain AI</h1>
            <p className="text-xs text-gray-500">Supply Chain Intelligence</p>
          </div>
        </div>

        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            AI-Powered Supply<br />Chain Optimization
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-8">
            Minimize food wastage, optimize inventory distribution, and improve
            demand forecasting accuracy across your entire supply chain network.
          </p>

          {/* Feature bullets */}
          <div className="space-y-3 mb-8">
            {[
              'Real-time spoilage prediction with ML',
              'Automated redistribution recommendations',
              'Multi-node inventory visibility',
            ].map(f => (
              <div key={f} className="flex items-center gap-2.5">
                <CheckIcon />
                <span className="text-sm text-gray-300">{f}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Nodes Monitored', value: '7+' },
              { label: 'Products Tracked', value: '15+' },
              { label: 'Spoilage Reduction', value: '34%' },
              { label: 'AI Accuracy', value: '~92%' },
            ].map(stat => (
              <div key={stat.label} className="bg-surface-700/50 rounded-xl p-4 border border-surface-600 backdrop-blur-sm">
                <p className="text-2xl font-bold text-brand-400">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-600 relative z-10">© 2025 FoodChain AI — Part 1: Foundation</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md py-8">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838l-2.727 1.17 1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
              </svg>
            </div>
            <span className="text-base font-bold text-white">FoodChain AI</span>
          </div>

          {/* ── Mode tab switcher ── */}
          <div className="flex bg-surface-800 rounded-xl p-1 mb-8 border border-surface-600">
            {[
              { id: 'signin', label: 'Sign In' },
              { id: 'signup', label: 'Create Account' },
            ].map(tab => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => switchMode(tab.id)}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === tab.id
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-900/50'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Heading ── */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {mode === 'signin'
                ? 'Sign in to your account to continue'
                : 'Get started with FoodChain AI today'}
            </p>
          </div>

          {/* ── Google button ── */}
          {noGoogleClientId ? (
            <button
              id="google-signin-placeholder"
              type="button"
              onClick={() => setLocalError('Google Sign-In requires VITE_GOOGLE_CLIENT_ID to be set in your .env file.')}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg border border-surface-500 bg-surface-800 hover:bg-surface-700 text-gray-200 text-sm font-medium transition-all duration-200 mb-4"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          ) : (
            <div id="google-signin-btn" ref={googleBtnRef} className="mb-4 flex justify-center" />
          )}

          {/* ── Divider ── */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-surface-600" />
            <span className="text-xs text-gray-500">or continue with email</span>
            <div className="flex-1 h-px bg-surface-600" />
          </div>

          {/* ── Error / Success banners ── */}
          {localError && (
            <div className="mb-4 p-3.5 bg-red-900/30 border border-red-700/50 rounded-lg flex items-start gap-2.5">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-red-300 text-sm">{localError}</p>
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3.5 bg-green-900/30 border border-green-700/50 rounded-lg flex items-center gap-2.5">
              <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-green-300 text-sm">{successMsg}</p>
            </div>
          )}

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Name — only for signup */}
            {mode === 'signup' && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Full name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="input-field"
                  autoComplete="name"
                  required
                />
              </div>
            )}

            {/* Email */}
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

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pr-10"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {mode === 'signup' && <StrengthBar password={password} />}
            </div>

            {/* Confirm password — only for signup */}
            {mode === 'signup' && (
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`input-field pr-10 ${
                      confirmPassword && confirmPassword !== password
                        ? 'border-red-500/60 focus:border-red-500'
                        : confirmPassword && confirmPassword === password
                        ? 'border-green-500/60 focus:border-green-500'
                        : ''
                    }`}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                    tabIndex={-1}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon open={showConfirm} />
                  </button>
                </div>
                {confirmPassword && (
                  <p className={`text-xs mt-1 ${confirmPassword === password ? 'text-green-400' : 'text-red-400'}`}>
                    {confirmPassword === password ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </p>
                )}
              </div>
            )}

            {/* Role — only for signup */}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Account role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      value: 'WAREHOUSE_ADMIN',
                      label: 'Warehouse Admin',
                      desc: 'Manage inventory & transfers',
                      icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      ),
                      color: 'text-blue-400',
                      activeRing: 'border-blue-500 bg-blue-500/10',
                    },
                    {
                      value: 'VIEWER',
                      label: 'Viewer',
                      desc: 'Read-only access to data',
                      icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ),
                      color: 'text-gray-400',
                      activeRing: 'border-surface-400 bg-surface-600/50',
                    },
                  ].map((r) => (
                    <button
                      key={r.value}
                      id={`role-${r.value.toLowerCase()}`}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`flex flex-col items-start gap-1.5 p-3.5 rounded-xl border-2 transition-all duration-150 text-left ${
                        role === r.value
                          ? r.activeRing
                          : 'border-surface-600 bg-surface-800 hover:border-surface-500'
                      }`}
                    >
                      <span className={`${r.color} ${role === r.value ? 'opacity-100' : 'opacity-60'}`}>{r.icon}</span>
                      <span className={`text-sm font-semibold ${role === r.value ? 'text-white' : 'text-gray-400'}`}>{r.label}</span>
                      <span className="text-xs text-gray-500 leading-tight">{r.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              id="submit-auth-btn"
              type="submit"
              disabled={submitting || googleLoading}
              className="btn-primary w-full mt-2 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {mode === 'signup' ? 'Creating account...' : 'Signing in...'}
                </>
              ) : mode === 'signup' ? 'Create Account' : 'Sign in'}
            </button>
          </form>

          {/* ── Switch mode link ── */}
          <p className="text-sm text-gray-400 text-center mt-5">
            {mode === 'signin' ? (
              <>Don't have an account?{' '}
                <button id="switch-to-signup" onClick={() => switchMode('signup')} className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                  Create one
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button id="switch-to-signin" onClick={() => switchMode('signin')} className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                  Sign in
                </button>
              </>
            )}
          </p>

          {/* ── Demo accounts (sign-in only) ── */}
          {mode === 'signin' && (
            <div className="mt-7">
              <p className="text-xs text-gray-500 text-center mb-3">— Quick demo access —</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { role: 'manager',   label: 'Manager',   color: 'text-purple-400', abbr: 'manager@' },
                  { role: 'warehouse', label: 'Warehouse', color: 'text-blue-400',   abbr: 'warehouse@' },
                  { role: 'viewer',    label: 'Viewer',    color: 'text-gray-400',   abbr: 'viewer@' },
                ].map(({ role, label, color, abbr }) => (
                  <button
                    key={role}
                    id={`demo-${role}`}
                    onClick={() => fillDemo(role)}
                    className="text-center p-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 rounded-lg transition-all duration-150 hover:border-surface-400 cursor-pointer"
                  >
                    <p className={`text-xs font-semibold ${color}`}>{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{abbr}</p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-600 text-center mt-2">All demo passwords: password123</p>
            </div>
          )}

          {/* ── Sign up benefits ── */}
          {mode === 'signup' && (
            <div className="mt-7 p-4 rounded-xl bg-surface-800/60 border border-surface-600">
              <p className="text-xs font-semibold text-gray-400 mb-3">What you get with a free account:</p>
              <div className="space-y-2">
                {[
                  'Read-only access to supply chain dashboard',
                  'View live inventory & forecasting data',
                  'Upgrade your role via admin request',
                ].map(b => (
                  <div key={b} className="flex items-start gap-2">
                    <CheckIcon />
                    <span className="text-xs text-gray-400">{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LoginPage
