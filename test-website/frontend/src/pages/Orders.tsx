import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../lib/api'
import { Package, Calendar, DollarSign } from 'lucide-react'

export default function Orders() {
  const { id } = useParams()
  const [orders, setOrders] = useState<any[]>([])
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      loadOrder(parseInt(id))
    } else {
      loadOrders()
    }
  }, [id])

  const loadOrders = async () => {
    try {
      const response = await api.get('/api/orders')
      setOrders(response.data)
    } catch (error) {
      console.error('Failed to load orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadOrder = async (orderId: number) => {
    try {
      const response = await api.get(`/api/orders/${orderId}`)
      setOrder(response.data)
    } catch (error) {
      console.error('Failed to load order:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (id && order) {
    return (
      <div>
        <Link to="/orders" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Orders
        </Link>
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold mb-6">Order #{order.id}</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h2 className="font-semibold mb-2">Order Details</h2>
              <div className="space-y-2 text-sm">
                <div><strong>Status:</strong> {order.status}</div>
                <div><strong>Date:</strong> {new Date(order.created_at).toLocaleString()}</div>
                <div><strong>Payment:</strong> {order.payment_method}</div>
                <div><strong>Total:</strong> ${order.total_amount.toFixed(2)}</div>
              </div>
            </div>
            <div>
              <h2 className="font-semibold mb-2">Shipping Address</h2>
              <div className="text-sm">
                {order.shipping_address.street}<br />
                {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}<br />
                {order.shipping_address.country}
              </div>
            </div>
          </div>
          <div>
            <h2 className="font-semibold mb-4">Order Items</h2>
            <div className="space-y-4">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded">
                  <div>
                    <p className="font-semibold">Product #{item.product_id}</p>
                    <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${item.price.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">Total: ${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">My Orders</h1>
        <p className="text-gray-600">View your order history</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No orders yet</p>
          <Link
            to="/products"
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-block"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="divide-y">
            {orders.map((order) => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="p-6 hover:bg-gray-50 block"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Package className="w-8 h-8 text-gray-400" />
                    <div>
                      <p className="font-semibold">Order #{order.id}</p>
                      <p className="text-sm text-gray-600 flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-lg flex items-center">
                      <DollarSign className="w-5 h-5 mr-1" />
                      {order.total_amount.toFixed(2)}
                    </p>
                    <span className={`px-2 py-1 text-xs rounded mt-2 inline-block ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}



