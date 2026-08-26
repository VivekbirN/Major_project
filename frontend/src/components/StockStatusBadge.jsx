// Stock status display config
const STATUS_CONFIG = {
  HEALTHY:    { label: 'Healthy',     cls: 'badge-healthy',     icon: '✓' },
  LOW_STOCK:  { label: 'Low Stock',   cls: 'badge-low-stock',   icon: '↓' },
  OVERSTOCKED:{ label: 'Overstocked', cls: 'badge-overstock',   icon: '↑' },
  NEAR_EXPIRY:{ label: 'Near Expiry', cls: 'badge-near-expiry', icon: '⏳' },
  CRITICAL:   { label: 'Critical',    cls: 'badge-critical',    icon: '!' },
}

const StockStatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: 'badge', icon: '' }
  return (
    <span className={cfg.cls}>
      {cfg.icon && <span className="mr-1">{cfg.icon}</span>}
      {cfg.label}
    </span>
  )
}

export { STATUS_CONFIG }
export default StockStatusBadge
