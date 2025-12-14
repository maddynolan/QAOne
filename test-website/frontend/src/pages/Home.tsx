import { Link } from 'react-router-dom'
import { ShoppingBag, Search, TrendingUp, Shield, User, ShoppingCart } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export default function Home() {
  const { isAuthenticated, user } = useAuthStore()

  return (
    <div>
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-12 mb-12">
        <h1 className="text-4xl font-bold mb-4">
          {isAuthenticated ? `Welcome back, ${user?.username || 'User'}!` : 'Welcome to TestStore'}
        </h1>
        <p className="text-xl mb-8">
          {isAuthenticated 
            ? 'Continue shopping or manage your account'
            : 'A comprehensive test website designed for QA AI platform testing'
          }
        </p>
        <div className="flex space-x-4">
          <Link
            to="/products"
            className="px-6 py-3 bg-white text-blue-600 rounded-md font-semibold hover:bg-gray-100"
          >
            Browse Products
          </Link>
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="px-6 py-3 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-600 flex items-center"
              >
                <User className="w-5 h-5 mr-2" />
                Dashboard
              </Link>
              <Link
                to="/cart"
                className="px-6 py-3 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-600 flex items-center"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                View Cart
              </Link>
            </>
          ) : (
            <Link
              to="/register"
              className="px-6 py-3 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-600"
            >
              Get Started
            </Link>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-white p-6 rounded-lg shadow">
          <ShoppingBag className="w-8 h-8 text-blue-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">E-Commerce</h3>
          <p className="text-gray-600">
            Full shopping experience with cart, checkout, and order management
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <Search className="w-8 h-8 text-blue-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Search & Filter</h3>
          <p className="text-gray-600">
            Advanced search, filtering, and sorting capabilities
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <TrendingUp className="w-8 h-8 text-blue-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Performance</h3>
          <p className="text-gray-600">
            Optimized for high concurrency and load testing
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <Shield className="w-8 h-8 text-blue-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Security</h3>
          <p className="text-gray-600">
            Authentication, authorization, and secure API endpoints
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white p-8 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-6">Platform Capabilities</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-3xl font-bold text-blue-600 mb-2">1000+</div>
            <div className="text-gray-600">Concurrent Users</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600 mb-2">50+</div>
            <div className="text-gray-600">API Endpoints</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600 mb-2">100+</div>
            <div className="text-gray-600">Test Scenarios</div>
          </div>
        </div>
      </div>
    </div>
  )
}


