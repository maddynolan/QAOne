# Test Website - Comprehensive QA AI Platform Testing

A robust, feature-rich test website designed specifically for testing all QA AI platform features including Flowstral, Nexus, API testing, Performance testing, and more. Built to handle 1000+ concurrent virtual users.

## 🎯 Purpose

This test website provides a comprehensive testing environment with:
- **Complex user flows** for Flowstral recording
- **Multiple UI interactions** for autonomous testing (Nexus)
- **50+ API endpoints** for API testing
- **Performance-optimized** architecture for load testing
- **Real-world scenarios** including authentication, e-commerce, admin panels

## 🏗️ Architecture

### Backend
- **Framework**: FastAPI (Python)
- **Database**: SQLite (can be upgraded to PostgreSQL)
- **Features**: 
  - RESTful API with 50+ endpoints
  - WebSocket support for real-time features
  - JWT authentication
  - File upload/download
  - Performance testing endpoints
  - Admin endpoints

### Frontend
- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Routing**: React Router
- **State Management**: Zustand
- **Features**:
  - User authentication (login, register)
  - Product catalog with search, filtering, pagination
  - Shopping cart and checkout
  - User dashboard
  - Admin panel
  - Order management

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd test-website/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python main.py
```

The backend will start on `http://localhost:8001`

### Frontend Setup

```bash
cd test-website/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will start on `http://localhost:3000`

## 📋 Test Credentials

### Admin Account
- **Username**: `admin`
- **Password**: `Admin@2024!Secure#Test`
- **Email**: `admin@test.com`

### Regular User Account
- **Username**: `testuser`
- **Password**: `TestUser@2024!Secure#Pass`
- **Email**: `user@test.com`

**Note:** Passwords have been updated to complex, secure passwords to avoid browser data breach warnings.

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login (OAuth2)
- `GET /api/auth/me` - Get current user info

### Products
- `GET /api/products` - List products (with pagination, search, filters)
- `GET /api/products/{id}` - Get product details
- `GET /api/products/count` - Get product count
- `GET /api/categories` - List categories
- `GET /api/categories/{id}` - Get category details

### Cart
- `GET /api/cart` - Get user's cart
- `POST /api/cart` - Add item to cart
- `PUT /api/cart/{id}` - Update cart item quantity
- `DELETE /api/cart/{id}` - Remove item from cart
- `DELETE /api/cart` - Clear cart

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders` - List user's orders
- `GET /api/orders/{id}` - Get order details
- `PUT /api/orders/{id}/status` - Update order status (admin only)

### File Operations
- `POST /api/upload` - Upload file
- `GET /api/files/{file_id}` - Download file

### WebSocket
- `WS /ws` - General WebSocket connection
- `WS /ws/{user_id}` - User-specific WebSocket

### Performance Testing
- `GET /api/performance/delay/{seconds}` - Simulate delay
- `GET /api/performance/load` - CPU-intensive operation
- `POST /api/performance/batch` - Batch processing

### Admin
- `GET /api/admin/users` - List users (admin only)
- `GET /api/admin/orders` - List all orders (admin only)
- `GET /api/admin/stats` - Platform statistics (admin only)

### Search
- `GET /api/search?q={query}` - Global search

## 🧪 Testing Scenarios

### Flowstral Testing
1. **User Registration Flow**
   - Navigate to register page
   - Fill registration form
   - Submit and verify success

2. **Product Browsing Flow**
   - Browse products
   - Apply filters (category, price range)
   - Search for products
   - View product details

3. **Shopping Cart Flow**
   - Add products to cart
   - Update quantities
   - Remove items
   - Proceed to checkout

4. **Checkout Flow**
   - Fill shipping address
   - Select payment method
   - Place order
   - View order confirmation

5. **Admin Flow**
   - Login as admin
   - View admin dashboard
   - Manage orders
   - View statistics

### Nexus Testing
- Autonomous exploration of all pages
- Form filling and submission
- Navigation between pages
- Error detection on invalid inputs
- Defect detection on broken flows

### API Testing
- **Authentication**: Test login, register, token refresh
- **CRUD Operations**: Products, orders, cart items
- **Search & Filter**: Test query parameters
- **File Upload**: Test multipart uploads
- **WebSocket**: Test real-time connections
- **Performance**: Test delay and load endpoints
- **Error Handling**: Test invalid requests, unauthorized access

### Performance Testing
- **Load Testing**: 1000 concurrent users
- **Stress Testing**: High request volumes
- **Endurance Testing**: Long-running sessions
- **Spike Testing**: Sudden traffic increases

## 📊 Database Schema

### Tables
- `users` - User accounts
- `categories` - Product categories
- `products` - Product catalog (100 products pre-loaded)
- `cart_items` - Shopping cart items
- `orders` - Order records
- `order_items` - Order line items
- `reviews` - Product reviews

### Sample Data
The database is automatically initialized with:
- 2 users (admin and testuser)
- 6 categories
- 100 products
- Sample metadata for testing

## 🔧 Configuration

### Backend Configuration
Edit `backend/main.py`:
- `SECRET_KEY` - JWT secret key
- `ACCESS_TOKEN_EXPIRE_MINUTES` - Token expiration
- `SQLALCHEMY_DATABASE_URL` - Database connection

### Frontend Configuration
Create `.env` file in `frontend/`:
```
VITE_API_URL=http://localhost:8001
```

## 🚦 Performance Optimizations

### Backend
- Async/await for I/O operations
- Connection pooling
- Efficient database queries
- Caching strategies (can be added)

### Frontend
- Code splitting
- Lazy loading
- Optimized re-renders
- Efficient state management

## 📈 Load Testing

### Using k6
```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '1m', target: 0 },
  ],
};

export default function () {
  const response = http.get('http://localhost:8001/api/products');
  check(response, {
    'status is 200': (r) => r.status === 200,
  });
}
```

### Using Locust
```python
from locust import HttpUser, task, between

class WebsiteUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def view_products(self):
        self.client.get("/api/products")
    
    @task(3)
    def view_product_detail(self):
        self.client.get("/api/products/1")
```

## 🔒 Security Features

- JWT-based authentication
- Password hashing (bcrypt)
- CORS configuration
- Input validation
- SQL injection protection (SQLAlchemy ORM)
- XSS protection (React escaping)

## 🐛 Known Limitations

- SQLite database (not recommended for production)
- No email verification
- No payment processing (simulated)
- Basic file storage (no cloud storage)

## 📝 API Documentation

Once the backend is running, visit:
- Swagger UI: `http://localhost:8001/docs`
- ReDoc: `http://localhost:8001/redoc`

## 🎨 Frontend Features

### Pages
- **Home**: Landing page with features overview
- **Products**: Product catalog with search and filters
- **Product Detail**: Individual product page
- **Cart**: Shopping cart management
- **Checkout**: Order placement
- **Dashboard**: User dashboard with stats
- **Orders**: Order history and details
- **Profile**: User profile management
- **Admin**: Admin panel (admin only)

### Components
- Responsive navigation
- Product cards
- Cart items
- Order summaries
- Forms with validation

## 🔄 Real-time Features

- WebSocket connections for notifications
- Order status updates
- Real-time cart synchronization (can be extended)

## 📦 Deployment

### Backend
```bash
# Using uvicorn
uvicorn main:app --host 0.0.0.0 --port 8001

# Using gunicorn (production)
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Frontend
```bash
# Build for production
npm run build

# Serve with nginx or similar
```

## 🤝 Contributing

This is a test website. Feel free to extend it with:
- More complex workflows
- Additional API endpoints
- More UI components
- Performance optimizations
- Security enhancements

## 📄 License

This is a test application for QA AI platform. Use as needed for testing purposes.

## 🆘 Troubleshooting

### Backend Issues
- Ensure Python 3.9+ is installed
- Check virtual environment is activated
- Verify all dependencies are installed
- Check database file permissions

### Frontend Issues
- Clear node_modules and reinstall
- Check Node.js version (18+)
- Verify API URL in .env
- Check browser console for errors

### Database Issues
- Delete `test_website.db` to reset
- Check file permissions
- Verify SQLite is available

## 📞 Support

For issues related to QA AI platform testing, refer to the main QA AI platform documentation.

---

**Built for comprehensive QA AI platform testing** 🚀


