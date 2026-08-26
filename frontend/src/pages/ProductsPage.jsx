import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { getProducts } from '../api/products'

const CATEGORY_COLORS = {
  Dairy: 'text-blue-400 bg-blue-900/30',
  Bakery: 'text-yellow-400 bg-yellow-900/30',
  Vegetables: 'text-green-400 bg-green-900/30',
  Fruits: 'text-orange-400 bg-orange-900/30',
  Grains: 'text-amber-400 bg-amber-900/30',
  Pulses: 'text-lime-400 bg-lime-900/30',
  'Meat & Poultry': 'text-red-400 bg-red-900/30',
  Oils: 'text-yellow-300 bg-yellow-900/30',
  Beverages: 'text-cyan-400 bg-cyan-900/30',
  Snacks: 'text-pink-400 bg-pink-900/30',
}

const shelfLifeColor = (days) => {
  if (days <= 5) return 'text-red-400'
  if (days <= 14) return 'text-yellow-400'
  if (days <= 30) return 'text-orange-400'
  return 'text-green-400'
}

const ProductsPage = () => {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({})
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  useEffect(() => {
    fetchProducts()
  }, [page, selectedCategory])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const params = { page, limit: 20 }
      if (selectedCategory) params.category = selectedCategory
      const data = await getProducts(params)
      setProducts(data.data.products)
      setPagination(data.data.pagination)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const categories = [...new Set(products.map(p => p.category))].filter(Boolean)

  const filtered = products.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout title="Products">
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Product Catalogue</h1>
          <p className="text-sm text-gray-400">{pagination.total || 0} products tracked</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field sm:w-52"
          />
          <select
            value={selectedCategory}
            onChange={e => { setSelectedCategory(e.target.value); setPage(1) }}
            className="input-field sm:w-40"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3.5 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">⚠️ {error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          [...Array(12)].map((_, i) => (
            <div key={i} className="card h-44 animate-pulse">
              <div className="h-4 bg-surface-700 rounded w-3/4 mb-3" />
              <div className="h-3 bg-surface-700 rounded w-1/2 mb-2" />
              <div className="h-3 bg-surface-700 rounded w-2/3" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-16 text-gray-500">
            No products found.
          </div>
        ) : (
          filtered.map(product => {
            const catColor = CATEGORY_COLORS[product.category] || 'text-gray-400 bg-surface-700'
            return (
              <div key={product.id} className="card hover:border-surface-500 transition-all duration-200 flex flex-col gap-3">
                {/* SKU + Category */}
                <div className="flex items-center justify-between">
                  <code className="text-xs bg-surface-700 px-2 py-0.5 rounded text-brand-400 font-mono">
                    {product.sku}
                  </code>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${catColor}`}>
                    {product.category}
                  </span>
                </div>

                {/* Name */}
                <h3 className="text-sm font-semibold text-white leading-snug">{product.name}</h3>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 mt-auto">
                  <div className="bg-surface-700/60 rounded-lg p-2.5">
                    <p className="text-xs text-gray-500 mb-0.5">Shelf Life</p>
                    <p className={`text-sm font-bold ${shelfLifeColor(product.shelf_life_days)}`}>
                      {product.shelf_life_days}d
                    </p>
                  </div>
                  <div className="bg-surface-700/60 rounded-lg p-2.5">
                    <p className="text-xs text-gray-500 mb-0.5">Unit Cost</p>
                    <p className="text-sm font-bold text-green-400">
                      ₹{parseFloat(product.unit_cost).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="btn-ghost text-xs py-1.5 px-4 disabled:opacity-40">
            ← Previous
          </button>
          <span className="text-xs text-gray-500">Page {page} of {pagination.totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages} className="btn-ghost text-xs py-1.5 px-4 disabled:opacity-40">
            Next →
          </button>
        </div>
      )}
    </Layout>
  )
}

export default ProductsPage
