"""
E-Commerce Demo Test Server
===========================
A simple mock e-commerce API for load testing purposes.
Runs on port 8002.

Endpoints:
- GET /health - Health check
- GET /api/products - List products
- GET /api/products/{id} - Get product by ID
- POST /api/cart - Add to cart
- GET /api/cart - Get cart
- POST /api/checkout - Checkout
- GET /api/orders - List orders
- POST /api/login - Login
- GET /api/user - Get user profile
"""

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Optional
import random
import time
from datetime import datetime

app = FastAPI(
    title="E-Commerce Demo API",
    description="Mock e-commerce server for load testing",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock Data
PRODUCTS = [
    {"id": 1, "name": "Laptop Pro", "price": 1299.99, "category": "Electronics", "stock": 50, "rating": 4.5},
    {"id": 2, "name": "Wireless Headphones", "price": 199.99, "category": "Electronics", "stock": 100, "rating": 4.2},
    {"id": 3, "name": "Smart Watch", "price": 349.99, "category": "Electronics", "stock": 75, "rating": 4.7},
    {"id": 4, "name": "Running Shoes", "price": 129.99, "category": "Sports", "stock": 200, "rating": 4.3},
    {"id": 5, "name": "Yoga Mat", "price": 49.99, "category": "Sports", "stock": 150, "rating": 4.6},
    {"id": 6, "name": "Coffee Maker", "price": 89.99, "category": "Home", "stock": 80, "rating": 4.4},
    {"id": 7, "name": "Desk Lamp", "price": 45.99, "category": "Home", "stock": 120, "rating": 4.1},
    {"id": 8, "name": "Backpack", "price": 79.99, "category": "Accessories", "stock": 90, "rating": 4.5},
    {"id": 9, "name": "Water Bottle", "price": 24.99, "category": "Accessories", "stock": 300, "rating": 4.8},
    {"id": 10, "name": "Bluetooth Speaker", "price": 149.99, "category": "Electronics", "stock": 60, "rating": 4.3},
]

USERS = {
    "demo@test.com": {"id": 1, "name": "Demo User", "email": "demo@test.com", "password": "demo123"},
    "admin@test.com": {"id": 2, "name": "Admin User", "email": "admin@test.com", "password": "admin123"},
}

# In-memory storage
carts = {}
orders = []
sessions = {}


# Models
class LoginRequest(BaseModel):
    email: str
    password: str

class CartItem(BaseModel):
    product_id: int
    quantity: int = 1

class CheckoutRequest(BaseModel):
    shipping_address: str
    payment_method: str = "credit_card"


# Routes
@app.get("/", response_class=HTMLResponse)
async def home():
    """Home page with demo store UI"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>E-Commerce Demo Store</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
            .header h1 { font-size: 2em; margin-bottom: 5px; }
            .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
            .products { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; margin-top: 20px; }
            .product { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); transition: transform 0.2s; }
            .product:hover { transform: translateY(-5px); }
            .product h3 { color: #333; margin-bottom: 10px; }
            .product .price { color: #667eea; font-size: 1.5em; font-weight: bold; }
            .product .category { color: #888; font-size: 0.9em; margin-bottom: 10px; }
            .product .rating { color: #ffc107; }
            .product button { background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin-top: 10px; width: 100%; }
            .product button:hover { background: #764ba2; }
            .cart { position: fixed; top: 20px; right: 20px; background: white; padding: 15px; border-radius: 12px; box-shadow: 0 2px 20px rgba(0,0,0,0.15); }
            .cart h4 { margin-bottom: 10px; }
            .api-info { background: #1e1e1e; color: #d4d4d4; padding: 20px; border-radius: 12px; margin-top: 30px; }
            .api-info h3 { color: #667eea; margin-bottom: 10px; }
            .api-info code { background: #2d2d2d; padding: 2px 6px; border-radius: 4px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🛒 E-Commerce Demo Store</h1>
            <p>Load Testing Target Server - Port 8002</p>
        </div>
        <div class="container">
            <div class="cart">
                <h4>🛒 Cart</h4>
                <p id="cart-count">0 items</p>
                <button onclick="checkout()">Checkout</button>
            </div>
            
            <h2>Products</h2>
            <div class="products" id="products"></div>
            
            <div class="api-info">
                <h3>📡 API Endpoints</h3>
                <ul style="list-style: none; line-height: 2;">
                    <li><code>GET /health</code> - Health check</li>
                    <li><code>GET /api/products</code> - List all products</li>
                    <li><code>GET /api/products/{id}</code> - Get product by ID</li>
                    <li><code>POST /api/cart</code> - Add item to cart</li>
                    <li><code>GET /api/cart</code> - Get cart contents</li>
                    <li><code>POST /api/checkout</code> - Process checkout</li>
                    <li><code>POST /api/login</code> - User login</li>
                </ul>
            </div>
        </div>
        
        <script>
            let cart = [];
            
            async function loadProducts() {
                const res = await fetch('/api/products');
                const data = await res.json();
                const container = document.getElementById('products');
                container.innerHTML = data.products.map(p => `
                    <div class="product">
                        <h3>${p.name}</h3>
                        <p class="category">${p.category}</p>
                        <p class="price">$${p.price.toFixed(2)}</p>
                        <p class="rating">${'★'.repeat(Math.round(p.rating))}${'☆'.repeat(5-Math.round(p.rating))} (${p.rating})</p>
                        <p style="color: ${p.stock > 20 ? 'green' : 'orange'}">Stock: ${p.stock}</p>
                        <button onclick="addToCart(${p.id})">Add to Cart</button>
                    </div>
                `).join('');
            }
            
            async function addToCart(productId) {
                await fetch('/api/cart', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({product_id: productId, quantity: 1})
                });
                cart.push(productId);
                document.getElementById('cart-count').textContent = cart.length + ' items';
            }
            
            async function checkout() {
                if (cart.length === 0) { alert('Cart is empty!'); return; }
                await fetch('/api/checkout', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({shipping_address: '123 Test St', payment_method: 'credit_card'})
                });
                alert('Order placed successfully!');
                cart = [];
                document.getElementById('cart-count').textContent = '0 items';
            }
            
            loadProducts();
        </script>
    </body>
    </html>
    """


@app.get("/health")
async def health_check():
    """Health check endpoint for load balancer/monitoring"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "uptime": time.time(),
        "version": "1.0.0"
    }


@app.get("/api/products")
async def list_products(
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    limit: int = 100
):
    """List all products with optional filtering"""
    # Simulate some processing time (5-20ms)
    time.sleep(random.uniform(0.005, 0.02))
    
    products = PRODUCTS.copy()
    
    if category:
        products = [p for p in products if p["category"].lower() == category.lower()]
    if min_price:
        products = [p for p in products if p["price"] >= min_price]
    if max_price:
        products = [p for p in products if p["price"] <= max_price]
    
    return {
        "products": products[:limit],
        "total": len(products),
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/products/{product_id}")
async def get_product(product_id: int):
    """Get a single product by ID"""
    time.sleep(random.uniform(0.003, 0.01))
    
    for product in PRODUCTS:
        if product["id"] == product_id:
            return {"product": product}
    
    raise HTTPException(status_code=404, detail="Product not found")


@app.post("/api/cart")
async def add_to_cart(item: CartItem):
    """Add an item to the cart"""
    time.sleep(random.uniform(0.005, 0.015))
    
    session_id = "default"  # Simplified - no real session handling
    
    if session_id not in carts:
        carts[session_id] = []
    
    # Find product
    product = next((p for p in PRODUCTS if p["id"] == item.product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    carts[session_id].append({
        "product_id": item.product_id,
        "product_name": product["name"],
        "quantity": item.quantity,
        "price": product["price"],
        "subtotal": product["price"] * item.quantity
    })
    
    return {
        "message": "Added to cart",
        "cart_count": len(carts[session_id]),
        "item": carts[session_id][-1]
    }


@app.get("/api/cart")
async def get_cart():
    """Get current cart contents"""
    time.sleep(random.uniform(0.003, 0.01))
    
    session_id = "default"
    cart_items = carts.get(session_id, [])
    
    total = sum(item["subtotal"] for item in cart_items)
    
    return {
        "items": cart_items,
        "item_count": len(cart_items),
        "total": round(total, 2)
    }


@app.post("/api/checkout")
async def checkout(request: CheckoutRequest):
    """Process checkout"""
    time.sleep(random.uniform(0.05, 0.15))  # Simulate payment processing
    
    session_id = "default"
    cart_items = carts.get(session_id, [])
    
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    total = sum(item["subtotal"] for item in cart_items)
    
    order = {
        "order_id": f"ORD-{random.randint(10000, 99999)}",
        "items": cart_items,
        "total": round(total, 2),
        "shipping_address": request.shipping_address,
        "payment_method": request.payment_method,
        "status": "confirmed",
        "created_at": datetime.now().isoformat()
    }
    
    orders.append(order)
    carts[session_id] = []  # Clear cart
    
    return {
        "message": "Order placed successfully",
        "order": order
    }


@app.get("/api/orders")
async def list_orders():
    """List all orders"""
    return {"orders": orders, "count": len(orders)}


@app.post("/api/login")
async def login(request: LoginRequest):
    """User login"""
    time.sleep(random.uniform(0.01, 0.03))
    
    user = USERS.get(request.email)
    if not user or user["password"] != request.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = f"tok_{random.randint(100000, 999999)}"
    sessions[token] = user["id"]
    
    return {
        "message": "Login successful",
        "token": token,
        "user": {"id": user["id"], "name": user["name"], "email": user["email"]}
    }


@app.get("/api/user")
async def get_user_profile():
    """Get user profile (mock)"""
    return {
        "user": {
            "id": 1,
            "name": "Demo User",
            "email": "demo@test.com",
            "member_since": "2024-01-01"
        }
    }


if __name__ == "__main__":
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    
    print("=" * 60)
    print("[ECOMMERCE] Demo Server")
    print("=" * 60)
    print(f"Starting on http://localhost:8002")
    print("")
    print("Available endpoints:")
    print("  GET  /              - Demo store UI")
    print("  GET  /health        - Health check")
    print("  GET  /api/products  - List products")
    print("  POST /api/cart      - Add to cart")
    print("  POST /api/checkout  - Process checkout")
    print("  POST /api/login     - User login")
    print("=" * 60)
    
    uvicorn.run(app, host="0.0.0.0", port=8002)

