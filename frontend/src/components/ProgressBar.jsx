// Capacity utilization thresholds
const CAPACITY_CONFIG = {
  NORMAL:   { label: 'Normal',   cls: 'badge-normal',   barClass: 'bg-green-500',  textClass: 'text-green-400'  },
  MODERATE: { label: 'Moderate', cls: 'badge-moderate', barClass: 'bg-yellow-500', textClass: 'text-yellow-400' },
  HIGH:     { label: 'High',     cls: 'badge-high-cap', barClass: 'bg-orange-500', textClass: 'text-orange-400' },
  CRITICAL: { label: 'Critical', cls: 'badge-critical-cap', barClass: 'bg-red-500', textClass: 'text-red-400'  },
}

const ProgressBar = ({ pct = 0, status = 'NORMAL', showLabel = true, size = 'md' }) => {
  const cfg = CAPACITY_CONFIG[status] || CAPACITY_CONFIG.NORMAL
  const height = size === 'sm' ? 'h-1.5' : 'h-2'

  return (
    <div className="w-full">
      <div className={`w-full bg-surface-600 rounded-full overflow-hidden ${height}`}>
        <div
          className={`${height} ${cfg.barClass} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex items-center justify-between mt-1">
          <span className={`text-xs font-medium ${cfg.textClass}`}>{pct}%</span>
          <span className={`text-xs ${cfg.textClass}`}>{cfg.label}</span>
        </div>
      )}
    </div>
  )
}

export { CAPACITY_CONFIG }
export default ProgressBar
