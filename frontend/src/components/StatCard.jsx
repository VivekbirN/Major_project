const StatCard = ({ title, value, subtitle, icon, trend, colorClass = 'text-brand-400', bgClass = 'bg-brand-900/30' }) => {
  return (
    <div className="card hover:border-surface-500 transition-colors duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{title}</p>
          <p className={`text-3xl font-bold ${colorClass} leading-tight`}>
            {value ?? (
              <span className="inline-block w-20 h-8 bg-surface-700 rounded animate-pulse" />
            )}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <p className={`text-xs mt-1.5 font-medium ${trend.positive ? 'text-green-400' : 'text-red-400'}`}>
              {trend.positive ? '↑' : '↓'} {trend.label}
            </p>
          )}
        </div>
        {icon && (
          <div className={`w-12 h-12 rounded-xl ${bgClass} flex items-center justify-center flex-shrink-0 ml-3`}>
            <span className={`text-2xl ${colorClass}`}>{icon}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default StatCard
