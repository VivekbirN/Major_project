import { Link } from 'react-router-dom'

const NotFoundPage = () => (
  <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center text-center p-6">
    <div className="w-16 h-16 bg-surface-800 border border-surface-600 rounded-2xl flex items-center justify-center mb-6">
      <span className="text-3xl">🔍</span>
    </div>
    <h1 className="text-4xl font-bold text-white mb-2">404</h1>
    <p className="text-gray-400 mb-6">The page you're looking for doesn't exist.</p>
    <Link to="/dashboard" className="btn-primary">
      ← Back to Dashboard
    </Link>
  </div>
)

export default NotFoundPage
