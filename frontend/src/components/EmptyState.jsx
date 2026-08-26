const EmptyState = ({ icon = '📭', title = 'No data found', subtitle = '', action = null }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-16 h-16 bg-surface-700 rounded-2xl flex items-center justify-center mb-4">
      <span className="text-3xl">{icon}</span>
    </div>
    <h3 className="text-sm font-semibold text-gray-300 mb-1">{title}</h3>
    {subtitle && <p className="text-xs text-gray-500 max-w-xs">{subtitle}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
)

export default EmptyState
