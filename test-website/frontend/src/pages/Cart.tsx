import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useCartStore } from '../store/cartStore'
import { Trash2, ShoppingCart, Plus, Minus } from 'lucide-react'

interface CartItem {
  id: number
  product_id: number
  quantity: number
  product: {
    id: number
    name: string
    price: number
    stock: number
    image_url: string | null
  }
}

export default function Cart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const { loadCartCount } = useCartStore()
  const navigate = useNavigate()

  useEffect(() => {
    loadCart()
  }, [])

  const loadCart = async () => {
    try {
      const response = await api.get('/api/cart')
      setCartItems(response.data)
    } catch (error) {
      console.error('Failed to load cart:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateQuantity = async (cartItemId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(cartItemId)
      return
    }

    try {
      await api.put(`/api/cart/${cartItemId}`, null, {
        params: { quantity: newQuantity },
      })
      loadCart()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to update cart')
    }
  }

  const removeItem = async (cartItemId: number) => {
    try {
      await api.delete(`/api/cart/${cartItemId}`)
      loadCart()
    } catch (error) {
      console.error('Failed to remove item:', error)
    }
  }

  const clearCart = async () => {
    if (confirm('Are you sure you want to clear your cart?')) {
      try {
        await api.delete('/api/cart')
        setCartItems([])
        loadCartCount()
      } catch (error) {
        console.error('Failed to clear cart:', error)
      }
    }
  }

  const total = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  if (loading) {
    return <div className="text-center py-12">Loading cart...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Shopping Cart</h1>
        <p className="text-gray-600">{cartItems.length} item(s) in your cart</p>
      </div>

      {cartItems.length === 0 ? (
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Your cart is empty</p>
          <Link
            to="/products"
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-block"
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              {cartItems.map((item) => (
                <div key={item.id} className="p-6 border-b last:border-b-0 flex items-center space-x-4">
                  <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    {item.product.image_url ? (
                      <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <ShoppingCart className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Link
                      to={`/products/${item.product.id}`}
                      className="font-semibold text-lg hover:text-blue-600"
                    >
                      {item.product.name}
                    </Link>
                    <div className="text-gray-600 mt-1">${item.product.price.toFixed(2)} each</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.product.stock}
                      className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-lg font-semibold">
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              <div className="p-6 border-t">
                <button
                  onClick={clearCart}
                  className="text-red-600 hover:underline"
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </div>
          <div>
            <div className="bg-white p-6 rounded-lg shadow sticky top-4">
              <h2 className="text-xl font-bold mb-4">Order Summary</h2>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping:</span>
                  <span>$10.00</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-4 border-t">
                  <span>Total:</span>
                  <span>${(total + 10).toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/checkout')}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


