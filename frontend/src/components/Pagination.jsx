const Pagination = ({ pagination, onPageChange }) => {
  if (!pagination || pagination.totalPages <= 1) return null

  const { page, totalPages, total, limit } = pagination
  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  // Generate page numbers to show
  const pages = []
  const delta = 1
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
    pages.push(i)
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-surface-600">
      <p className="text-xs text-gray-500">
        Showing <span className="text-gray-300 font-medium">{start}–{end}</span> of{' '}
        <span className="text-gray-300 font-medium">{total}</span> records
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="btn-ghost text-xs py-1 px-2 disabled:opacity-30"
        >
          «
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="btn-ghost text-xs py-1 px-3 disabled:opacity-30"
        >
          ‹ Prev
        </button>
        {pages[0] > 1 && <span className="text-gray-600 text-xs px-1">…</span>}
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`text-xs py-1 px-3 rounded-lg transition-colors ${
              p === page
                ? 'bg-brand-700/60 text-white border border-brand-600/50'
                : 'text-gray-400 hover:text-white hover:bg-surface-700'
            }`}
          >
            {p}
          </button>
        ))}
        {pages[pages.length - 1] < totalPages && <span className="text-gray-600 text-xs px-1">…</span>}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn-ghost text-xs py-1 px-3 disabled:opacity-30"
        >
          Next ›
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className="btn-ghost text-xs py-1 px-2 disabled:opacity-30"
        >
          »
        </button>
      </div>
    </div>
  )
}

export default Pagination
