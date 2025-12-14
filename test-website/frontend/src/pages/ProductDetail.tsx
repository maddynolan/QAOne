import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { Star, ShoppingCart, Package, Check } from 'lucide-react'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const { incrementCart, loadCartCount } = useCartStore()
  const [product, setProduct] = useState<any>(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    loadProduct()
  }, [id])

  const loadProduct = async () => {
    try {
      const response = await api.get(`/api/products/${id}`)
      setProduct(response.data)
    } catch (error) {
      console.error('Failed to load product:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    if (quantity < 1 || quantity > product.stock) {
      alert('Invalid quantity')
      return
    }

    setAdding(true)
    try {
      await api.post('/api/cart', null, {
        params: {
          product_id: id,
          quantity: quantity,
        },
      })
      incrementCart()
      loadCartCount()
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to add to cart')
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading product...</div>
  }

  if (!product) {
    return <div className="text-center py-12">Product not found</div>
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
          <div>
            <div className="aspect-square bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-lg" />
              ) : (
                <Package className="w-32 h-32 text-gray-400" />
              )}
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
            <div className="flex items-center mb-4">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              <span className="ml-2 text-lg">
                {product.rating} ({product.review_count} reviews)
              </span>
            </div>
            <div className="text-4xl font-bold text-blue-600 mb-6">
              ${product.price.toFixed(2)}
            </div>
            <div className="mb-6">
              <p className="text-gray-700 mb-4">{product.description}</p>
              <div className="space-y-2">
                <div><strong>SKU:</strong> {product.sku}</div>
                <div><strong>Stock:</strong> {product.stock} available</div>
                {product.metadata && Object.keys(product.metadata).length > 0 && (
                  <div>
                    <strong>Details:</strong>
                    <ul className="list-disc list-inside ml-4">
                      {Object.entries(product.metadata).map(([key, value]: [string, any]) => (
                        <li key={key}>
                          {key}: {Array.isArray(value) ? value.join(', ') : value}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4 mb-6">
              <label className="font-semibold">Quantity:</label>
              <input
                type="number"
                min="1"
                max={product.stock}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {showSuccess && (
              <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md flex items-center">
                <Check className="w-5 h-5 mr-2" />
                Successfully added to cart!
              </div>
            )}
            <button
              onClick={handleAddToCart}
              disabled={adding || product.stock === 0}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              {adding ? 'Adding...' : product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


