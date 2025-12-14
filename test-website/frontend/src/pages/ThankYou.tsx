import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle, Home, ShoppingBag } from 'lucide-react'

export default function ThankYou() {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')
  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="mb-6">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-lg text-gray-600 mb-4">
            Your order has been placed successfully.
          </p>
          {orderId && (
            <p className="text-sm text-gray-500">
              Order ID: <span className="font-semibold">#{orderId}</span>
            </p>
          )}
        </div>

        <div className="mb-8">
          <p className="text-gray-700 mb-6">
            We've received your order and will begin processing it shortly. 
            You'll receive a confirmation email with your order details.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Home className="w-5 h-5 mr-2" />
            Back to Homepage
          </Link>
          <Link
            to="/products"
            className="inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            <ShoppingBag className="w-5 h-5 mr-2" />
            Continue Shopping
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t">
          <Link
            to="/dashboard"
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            View your orders in Dashboard →
          </Link>
        </div>
      </div>
    </div>
  )
}

