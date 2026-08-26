import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Restricts access to specific roles.
 * Usage: <RoleRoute roles={['SUPPLY_CHAIN_MANAGER']}><Page /></RoleRoute>
 */
const RoleRoute = ({ children, roles }) => {
  const { user } = useAuth()

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default RoleRoute
