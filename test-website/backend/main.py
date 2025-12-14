"""
Comprehensive Test Website Backend
Built for testing Flowstral, Nexus, API testing, Performance, and all QA AI features
Designed to handle 1000+ concurrent users
"""

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse, FileResponse, Response, HTMLResponse
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
import json
import asyncio
from pathlib import Path
import uuid
import aiofiles
from collections import defaultdict
import time
import hashlib

# Configuration
SECRET_KEY = "test-website-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_website.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# FastAPI app
app = FastAPI(
    title="Test Website API",
    description="Comprehensive test website for QA AI platform testing",
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

# Security - Use simple hashing for test website (not for production)
def get_password_hash(password: str) -> str:
    """Simple password hashing for test website"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password"""
    return get_password_hash(plain_password) == hashed_password

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# WebSocket connections manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.user_connections: Dict[str, List[WebSocket]] = defaultdict(list)
    
    async def connect(self, websocket: WebSocket, user_id: Optional[str] = None):
        await websocket.accept()
        self.active_connections.append(websocket)
        if user_id:
            self.user_connections[user_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, user_id: Optional[str] = None):
        self.active_connections.remove(websocket)
        if user_id and websocket in self.user_connections[user_id]:
            self.user_connections[user_id].remove(websocket)
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)
    
    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)
    
    async def send_to_user(self, user_id: str, message: str):
        for connection in self.user_connections[user_id]:
            await connection.send_text(message)

manager = ConnectionManager()

# Database Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    profile_data = Column(JSON, default={})
    
    orders = relationship("Order", back_populates="user")
    cart_items = relationship("CartItem", back_populates="user")

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text)
    slug = Column(String, unique=True, index=True)
    
    products = relationship("Product", back_populates="category")

class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text)
    price = Column(Float)
    stock = Column(Integer, default=0)
    category_id = Column(Integer, ForeignKey("categories.id"))
    image_url = Column(String, nullable=True)
    sku = Column(String, unique=True, index=True)
    rating = Column(Float, default=0.0)
    review_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    product_metadata = Column(JSON, default={})  # Renamed from 'metadata' to avoid SQLAlchemy conflict
    created_at = Column(DateTime, default=datetime.utcnow)
    
    category = relationship("Category", back_populates="products")
    order_items = relationship("OrderItem", back_populates="product")
    cart_items = relationship("CartItem", back_populates="product")

class CartItem(Base):
    __tablename__ = "cart_items"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="cart_items")
    product = relationship("Product", back_populates="cart_items")

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="pending")  # pending, processing, shipped, delivered, cancelled
    total_amount = Column(Float)
    shipping_address = Column(JSON)
    payment_method = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order")

class OrderItem(Base):
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer)
    price = Column(Float)
    
    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    rating = Column(Integer)
    comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

# Pydantic Models
class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str]
    is_admin: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    stock: int
    category_id: int
    sku: str
    product_metadata: Optional[Dict[str, Any]] = None  # Maps to metadata in response

class ProductResponse(BaseModel):
    id: int
    name: str
    description: str
    price: float
    stock: int
    category_id: int
    image_url: Optional[str]
    sku: str
    rating: float
    review_count: int
    is_active: bool
    metadata: Dict[str, Any]
    created_at: datetime
    
    class Config:
        from_attributes = True
        populate_by_name = True

class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    slug: str
    
    class Config:
        from_attributes = True

class CartItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    product: ProductResponse
    
    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    shipping_address: Dict[str, Any]
    payment_method: str

class OrderResponse(BaseModel):
    id: int
    user_id: int
    status: str
    total_amount: float
    shipping_address: Dict[str, Any]
    payment_method: str
    created_at: datetime
    items: List[Dict[str, Any]]
    
    class Config:
        from_attributes = True

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        # Convert from string to int (JWT stores sub as string)
        user_id = int(user_id_str)
    except (JWTError, ValueError, TypeError):
        raise credentials_exception
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user

# Utility functions - using hashlib (defined above)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Initialize database with sample data
def init_db():
    db = SessionLocal()
    try:
        # Check if data exists
        if db.query(User).count() > 0:
            return
        
        # Create admin user
        # Password: Admin@2024!Secure#Test
        admin = User(
            email="admin@test.com",
            username="admin",
            hashed_password=get_password_hash("Admin@2024!Secure#Test"),
            full_name="Admin User",
            is_admin=True
        )
        db.add(admin)
        
        # Create test user
        # Password: TestUser@2024!Secure#Pass
        test_user = User(
            email="user@test.com",
            username="testuser",
            hashed_password=get_password_hash("TestUser@2024!Secure#Pass"),
            full_name="Test User"
        )
        db.add(test_user)
        
        # Create categories
        categories_data = [
            {"name": "Electronics", "description": "Electronic devices and gadgets", "slug": "electronics"},
            {"name": "Clothing", "description": "Apparel and fashion items", "slug": "clothing"},
            {"name": "Books", "description": "Books and literature", "slug": "books"},
            {"name": "Home & Garden", "description": "Home improvement and garden supplies", "slug": "home-garden"},
            {"name": "Sports", "description": "Sports equipment and accessories", "slug": "sports"},
            {"name": "Toys", "description": "Toys and games", "slug": "toys"},
        ]
        
        categories = []
        for cat_data in categories_data:
            category = Category(**cat_data)
            db.add(category)
            categories.append(category)
        
        db.commit()
        
        # Create products
        products_data = []
        for i in range(1, 101):  # 100 products
            category = categories[i % len(categories)]
            products_data.append({
                "name": f"Product {i}",
                "description": f"Detailed description for product {i}. This is a comprehensive product description that includes features, benefits, and specifications.",
                "price": round(10.0 + (i * 2.5), 2),
                "stock": 100 - (i % 50),
                "category_id": category.id,
                "sku": f"SKU-{i:04d}",
                "rating": round(3.0 + (i % 5) * 0.4, 1),
                "review_count": i * 3,
                "product_metadata": {"color": ["red", "blue", "green"][i % 3], "size": ["S", "M", "L", "XL"][i % 4]}
            })
        
        for prod_data in products_data:
            product = Product(**prod_data)
            db.add(product)
        
        db.commit()
        print("Database initialized with sample data")
    except Exception as e:
        print(f"Error initializing database: {e}")
        db.rollback()
    finally:
        db.close()

# Initialize on startup
@app.on_event("startup")
async def startup_event():
    init_db()

# Health check
@app.get("/")
async def root():
    return {"message": "Test Website API", "version": "1.0.0", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Authentication endpoints
@app.post("/api/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Create user
    user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@app.post("/api/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is inactive")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires  # JWT requires sub to be string
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

# Product endpoints
@app.get("/api/products", response_model=List[ProductResponse])
async def get_products(
    skip: int = 0,
    limit: int = 20,
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: Optional[str] = "name",
    order: Optional[str] = "asc",
    db: Session = Depends(get_db)
):
    query = db.query(Product).filter(Product.is_active == True)
    
    if category_id:
        query = query.filter(Product.category_id == category_id)
    
    if search:
        query = query.filter(
            (Product.name.contains(search)) |
            (Product.description.contains(search)) |
            (Product.sku.contains(search))
        )
    
    if min_price:
        query = query.filter(Product.price >= min_price)
    
    if max_price:
        query = query.filter(Product.price <= max_price)
    
    # Sorting
    if sort_by == "price":
        if order == "desc":
            query = query.order_by(Product.price.desc())
        else:
            query = query.order_by(Product.price.asc())
    elif sort_by == "rating":
        if order == "desc":
            query = query.order_by(Product.rating.desc())
        else:
            query = query.order_by(Product.rating.asc())
    else:
        if order == "desc":
            query = query.order_by(Product.name.desc())
        else:
            query = query.order_by(Product.name.asc())
    
    products = query.offset(skip).limit(limit).all()
    # Map product_metadata to metadata for response
    result = []
    for p in products:
        p_dict = {
            **{k: getattr(p, k) for k in ['id', 'name', 'description', 'price', 'stock', 
                                          'category_id', 'image_url', 'sku', 'rating', 
                                          'review_count', 'is_active', 'created_at']},
            'metadata': getattr(p, 'product_metadata', {})
        }
        result.append(ProductResponse(**p_dict))
    return result

@app.get("/api/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    # Map product_metadata to metadata for response
    p_dict = {
        **{k: getattr(product, k) for k in ['id', 'name', 'description', 'price', 'stock', 
                                          'category_id', 'image_url', 'sku', 'rating', 
                                          'review_count', 'is_active', 'created_at']},
        'metadata': getattr(product, 'product_metadata', {})
    }
    return ProductResponse(**p_dict)

@app.get("/api/products/count")
async def get_products_count(
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: Optional[str] = None,  # Accept but ignore (for frontend compatibility)
    order: Optional[str] = None,  # Accept but ignore (for frontend compatibility)
    db: Session = Depends(get_db)
):
    query = db.query(Product).filter(Product.is_active == True)
    
    if category_id:
        query = query.filter(Product.category_id == category_id)
    
    if search:
        query = query.filter(
            (Product.name.contains(search)) |
            (Product.description.contains(search))
        )
    
    if min_price:
        query = query.filter(Product.price >= min_price)
    
    if max_price:
        query = query.filter(Product.price <= max_price)
    
    count = query.count()
    return {"count": count}

# Category endpoints
@app.get("/api/categories", response_model=List[CategoryResponse])
async def get_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).all()
    return categories

@app.get("/api/categories/{category_id}", response_model=CategoryResponse)
async def get_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

# Cart endpoints
@app.get("/api/cart", response_model=List[CartItemResponse])
async def get_cart(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cart_items = db.query(CartItem).filter(CartItem.user_id == current_user.id).all()
    # Map product_metadata to metadata for each cart item's product
    result = []
    for item in cart_items:
        product = item.product
        # Create ProductResponse with mapped metadata
        product_dict = {
            **{k: getattr(product, k) for k in ['id', 'name', 'description', 'price', 'stock', 
                                              'category_id', 'image_url', 'sku', 'rating', 
                                              'review_count', 'is_active', 'created_at']},
            'metadata': getattr(product, 'product_metadata', {})
        }
        product_response = ProductResponse(**product_dict)
        # Create CartItemResponse with mapped product
        cart_item_dict = {
            'id': item.id,
            'product_id': item.product_id,
            'quantity': item.quantity,
            'product': product_response
        }
        result.append(CartItemResponse(**cart_item_dict))
    return result

@app.post("/api/cart")
async def add_to_cart(
    product_id: int,
    quantity: int = 1,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product.stock < quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    # Check if item already in cart
    cart_item = db.query(CartItem).filter(
        CartItem.user_id == current_user.id,
        CartItem.product_id == product_id
    ).first()
    
    if cart_item:
        cart_item.quantity += quantity
    else:
        cart_item = CartItem(
            user_id=current_user.id,
            product_id=product_id,
            quantity=quantity
        )
        db.add(cart_item)
    
    db.commit()
    db.refresh(cart_item)
    return {"message": "Item added to cart", "cart_item": cart_item}

@app.put("/api/cart/{cart_item_id}")
async def update_cart_item(
    cart_item_id: int,
    quantity: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cart_item = db.query(CartItem).filter(
        CartItem.id == cart_item_id,
        CartItem.user_id == current_user.id
    ).first()
    
    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    
    if quantity <= 0:
        db.delete(cart_item)
        db.commit()
        return {"message": "Item removed from cart"}
    
    if cart_item.product.stock < quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    cart_item.quantity = quantity
    db.commit()
    return {"message": "Cart item updated", "cart_item": cart_item}

@app.delete("/api/cart/{cart_item_id}")
async def remove_from_cart(
    cart_item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cart_item = db.query(CartItem).filter(
        CartItem.id == cart_item_id,
        CartItem.user_id == current_user.id
    ).first()
    
    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    
    db.delete(cart_item)
    db.commit()
    return {"message": "Item removed from cart"}

@app.delete("/api/cart")
async def clear_cart(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(CartItem).filter(CartItem.user_id == current_user.id).delete()
    db.commit()
    return {"message": "Cart cleared"}

# Order endpoints
@app.post("/api/orders", response_model=OrderResponse)
async def create_order(
    order_data: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get cart items
    cart_items = db.query(CartItem).filter(CartItem.user_id == current_user.id).all()
    
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    # Calculate total
    total_amount = sum(item.product.price * item.quantity for item in cart_items)
    
    # Create order
    order = Order(
        user_id=current_user.id,
        status="pending",
        total_amount=total_amount,
        shipping_address=order_data.shipping_address,
        payment_method=order_data.payment_method
    )
    db.add(order)
    db.flush()
    
    # Create order items
    for cart_item in cart_items:
        order_item = OrderItem(
            order_id=order.id,
            product_id=cart_item.product_id,
            quantity=cart_item.quantity,
            price=cart_item.product.price
        )
        db.add(order_item)
        
        # Update product stock
        cart_item.product.stock -= cart_item.quantity
    
    # Clear cart
    db.query(CartItem).filter(CartItem.user_id == current_user.id).delete()
    
    db.commit()
    db.refresh(order)
    
    # Convert order items to dictionaries for response
    items_dict = []
    for item in order.items:
        items_dict.append({
            'id': item.id,
            'product_id': item.product_id,
            'quantity': item.quantity,
            'price': item.price
        })
    
    # Create OrderResponse with proper items format
    order_dict = {
        'id': order.id,
        'user_id': order.user_id,
        'status': order.status,
        'total_amount': order.total_amount,
        'shipping_address': order.shipping_address,
        'payment_method': order.payment_method,
        'created_at': order.created_at,
        'items': items_dict
    }
    
    # Send notification via WebSocket
    await manager.send_to_user(str(current_user.id), json.dumps({
        "type": "order_created",
        "order_id": order.id,
        "total_amount": total_amount
    }))
    
    return OrderResponse(**order_dict)

@app.get("/api/orders", response_model=List[OrderResponse])
async def get_orders(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    orders = db.query(Order).filter(Order.user_id == current_user.id).order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    # Convert orders to proper response format
    result = []
    for order in orders:
        items_dict = [{
            'id': item.id,
            'product_id': item.product_id,
            'quantity': item.quantity,
            'price': item.price
        } for item in order.items]
        order_dict = {
            'id': order.id,
            'user_id': order.user_id,
            'status': order.status,
            'total_amount': order.total_amount,
            'shipping_address': order.shipping_address,
            'payment_method': order.payment_method,
            'created_at': order.created_at,
            'items': items_dict
        }
        result.append(OrderResponse(**order_dict))
    return result

@app.get("/api/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Convert order items to dictionaries for response
    items_dict = [{
        'id': item.id,
        'product_id': item.product_id,
        'quantity': item.quantity,
        'price': item.price
    } for item in order.items]
    
    order_dict = {
        'id': order.id,
        'user_id': order.user_id,
        'status': order.status,
        'total_amount': order.total_amount,
        'shipping_address': order.shipping_address,
        'payment_method': order.payment_method,
        'created_at': order.created_at,
        'items': items_dict
    }
    return OrderResponse(**order_dict)

@app.put("/api/orders/{order_id}/status")
async def update_order_status(
    order_id: int,
    status: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Only admin can update status
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can update order status")
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = status
    order.updated_at = datetime.utcnow()
    db.commit()
    
    # Notify user
    await manager.send_to_user(str(order.user_id), json.dumps({
        "type": "order_status_updated",
        "order_id": order.id,
        "status": status
    }))
    
    return {"message": "Order status updated", "order": order}

# File upload endpoint
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    file_ext = Path(file.filename).suffix
    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}{file_ext}"
    
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    return {
        "file_id": file_id,
        "filename": file.filename,
        "url": f"/api/files/{file_id}{file_ext}",
        "size": len(content)
    }

@app.get("/api/files/{file_id}")
async def get_file(file_id: str):
    file_path = UPLOAD_DIR / file_id
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

# WebSocket endpoints are now enhanced below (see websocket_endpoint_enhanced)

# Performance testing endpoints
@app.get("/api/performance/delay/{seconds}")
async def performance_delay(seconds: float = 0.1):
    await asyncio.sleep(seconds)
    return {"delay": seconds, "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/performance/load")
async def performance_load(iterations: int = 1000):
    start = time.time()
    result = sum(i * i for i in range(iterations))
    elapsed = time.time() - start
    return {
        "iterations": iterations,
        "result": result,
        "elapsed_time": elapsed,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/api/performance/batch")
async def performance_batch(items: List[Dict[str, Any]]):
    start = time.time()
    processed = []
    for item in items:
        processed.append({
            "id": item.get("id"),
            "processed": True,
            "data": item
        })
    elapsed = time.time() - start
    return {
        "count": len(processed),
        "processed": processed,
        "elapsed_time": elapsed
    }

# Admin endpoints
@app.get("/api/admin/users")
async def admin_get_users(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = db.query(User).offset(skip).limit(limit).all()
    return users

@app.get("/api/admin/orders")
async def admin_get_orders(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = db.query(Order)
    if status:
        query = query.filter(Order.status == status)
    
    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return orders

@app.get("/api/admin/stats")
async def admin_get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    stats = {
        "total_users": db.query(User).count(),
        "total_products": db.query(Product).count(),
        "total_orders": db.query(Order).count(),
        "total_revenue": db.query(Order).with_entities(
            db.func.sum(Order.total_amount)
        ).scalar() or 0.0,
        "pending_orders": db.query(Order).filter(Order.status == "pending").count(),
    }
    
    return stats

# Search endpoint
@app.get("/api/search")
async def search(
    q: str,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    results = {
        "products": [],
        "categories": []
    }
    
    # Search products
    products = db.query(Product).filter(
        (Product.name.contains(q)) |
        (Product.description.contains(q)) |
        (Product.sku.contains(q))
    ).limit(limit).all()
    results["products"] = products
    
    # Search categories
    categories = db.query(Category).filter(
        (Category.name.contains(q)) |
        (Category.description.contains(q))
    ).limit(limit).all()
    results["categories"] = categories
    
    return results

# ============================================================================
# SOAP Endpoints (WSDL-based)
# ============================================================================

@app.get("/soap", response_class=HTMLResponse)
async def soap_wsdl():
    """Return WSDL for SOAP service"""
    wsdl_content = """<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/"
             xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
             xmlns:tns="http://testwebsite.com/soap"
             xmlns:xsd="http://www.w3.org/2001/XMLSchema"
             targetNamespace="http://testwebsite.com/soap"
             name="TestWebsiteSOAPService">
  <types>
    <xsd:schema targetNamespace="http://testwebsite.com/soap">
      <xsd:complexType name="Product">
        <xsd:sequence>
          <xsd:element name="id" type="xsd:int"/>
          <xsd:element name="name" type="xsd:string"/>
          <xsd:element name="description" type="xsd:string"/>
          <xsd:element name="price" type="xsd:double"/>
          <xsd:element name="stock" type="xsd:int"/>
        </xsd:sequence>
      </xsd:complexType>
      <xsd:complexType name="GetProductRequest">
        <xsd:sequence>
          <xsd:element name="product_id" type="xsd:int"/>
        </xsd:sequence>
      </xsd:complexType>
      <xsd:complexType name="GetProductResponse">
        <xsd:sequence>
          <xsd:element name="product" type="tns:Product"/>
        </xsd:sequence>
      </xsd:complexType>
    </xsd:schema>
  </types>
  <message name="GetProductRequest">
    <part name="parameters" element="tns:GetProductRequest"/>
  </message>
  <message name="GetProductResponse">
    <part name="parameters" element="tns:GetProductResponse"/>
  </message>
  <portType name="TestWebsitePortType">
    <operation name="GetProduct">
      <input message="tns:GetProductRequest"/>
      <output message="tns:GetProductResponse"/>
    </operation>
  </portType>
  <binding name="TestWebsiteBinding" type="tns:TestWebsitePortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="GetProduct">
      <soap:operation soapAction="http://testwebsite.com/soap/GetProduct"/>
      <input><soap:body use="literal"/></input>
      <output><soap:body use="literal"/></output>
    </operation>
  </binding>
  <service name="TestWebsiteSOAPService">
    <port name="TestWebsitePort" binding="tns:TestWebsiteBinding">
      <soap:address location="http://localhost:8002/soap"/>
    </port>
  </service>
</definitions>"""
    return Response(content=wsdl_content, media_type="application/xml")

@app.post("/soap")
async def soap_endpoint(request: Request):
    """SOAP endpoint handler"""
    body = await request.body()
    body_str = body.decode('utf-8')
    
    # Simple SOAP request parsing (for testing)
    if "GetProduct" in body_str:
        # Extract product_id from SOAP body
        import re
        product_id_match = re.search(r'<product_id>(\d+)</product_id>', body_str)
        product_id = int(product_id_match.group(1)) if product_id_match else 1
        
        db = SessionLocal()
        try:
            product = db.query(Product).filter(Product.id == product_id).first()
            if not product:
                raise HTTPException(status_code=404, detail="Product not found")
            
            # Return SOAP response
            soap_response = f"""<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetProductResponse xmlns="http://testwebsite.com/soap">
      <product>
        <id>{product.id}</id>
        <name>{product.name}</name>
        <description>{product.description}</description>
        <price>{product.price}</price>
        <stock>{product.stock}</stock>
      </product>
    </GetProductResponse>
  </soap:Body>
</soap:Envelope>"""
            return Response(content=soap_response, media_type="application/xml")
        finally:
            db.close()
    
    return Response(content="<soap:Fault><faultstring>Unknown operation</faultstring></soap:Fault>", 
                   media_type="application/xml", status_code=500)

# ============================================================================
# GraphQL Endpoint
# ============================================================================

try:
    import strawberry
    from strawberry.fastapi import GraphQLRouter
    
    @strawberry.type
    class ProductType:
        id: int
        name: str
        description: str
        price: float
        stock: int
        category_id: int
    
    @strawberry.type
    class Query:
        @strawberry.field
        def products(self, skip: int = 0, limit: int = 20) -> List[ProductType]:
            db = SessionLocal()
            try:
                products = db.query(Product).offset(skip).limit(limit).all()
                return [ProductType(
                    id=p.id,
                    name=p.name,
                    description=p.description,
                    price=p.price,
                    stock=p.stock,
                    category_id=p.category_id
                ) for p in products]
            finally:
                db.close()
        
        @strawberry.field
        def product(self, id: int) -> Optional[ProductType]:
            db = SessionLocal()
            try:
                p = db.query(Product).filter(Product.id == id).first()
                if not p:
                    return None
                return ProductType(
                    id=p.id,
                    name=p.name,
                    description=p.description,
                    price=p.price,
                    stock=p.stock,
                    category_id=p.category_id
                )
            finally:
                db.close()
    
    schema = strawberry.Schema(query=Query)
    graphql_app = GraphQLRouter(schema)
    app.include_router(graphql_app, prefix="/graphql")
except ImportError:
    # Fallback if strawberry not installed
    @app.post("/graphql")
    async def graphql_endpoint(request: Request):
        """GraphQL endpoint (fallback if strawberry not available)"""
        body = await request.json()
        query = body.get("query", "")
        
        # Simple GraphQL query handler
        if "products" in query.lower():
            db = SessionLocal()
            try:
                products = db.query(Product).limit(20).all()
                return {
                    "data": {
                        "products": [{
                            "id": p.id,
                            "name": p.name,
                            "description": p.description,
                            "price": p.price,
                            "stock": p.stock,
                            "categoryId": p.category_id
                        } for p in products]
                    }
                }
            finally:
                db.close()
        
        return {"data": None, "errors": [{"message": "Query not supported"}]}

# ============================================================================
# Enhanced WebSocket Endpoints
# ============================================================================

@app.websocket("/ws")
async def websocket_endpoint_enhanced(websocket: WebSocket):
    """Enhanced WebSocket endpoint with message handling"""
    await manager.connect(websocket)
    try:
        # Send connection confirmation
        await manager.send_personal_message(json.dumps({
            "type": "connected",
            "sessionId": str(uuid.uuid4()),
            "serverTime": datetime.utcnow().isoformat()
        }), websocket)
        
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                action = message.get("action", "")
                
                if action == "ping":
                    await manager.send_personal_message(json.dumps({
                        "type": "pong",
                        "serverTime": datetime.utcnow().isoformat()
                    }), websocket)
                elif action == "subscribe":
                    channel = message.get("channel", "")
                    await manager.send_personal_message(json.dumps({
                        "type": "subscribed",
                        "channel": channel
                    }), websocket)
                elif action == "message":
                    # Echo message back
                    await manager.send_personal_message(json.dumps({
                        "type": "message",
                        "channel": message.get("channel", ""),
                        "data": message.get("data", {})
                    }), websocket)
                else:
                    await manager.send_personal_message(json.dumps({
                        "type": "error",
                        "code": "UNKNOWN_ACTION",
                        "message": f"Unknown action: {action}"
                    }), websocket)
            except json.JSONDecodeError:
                await manager.send_personal_message(json.dumps({
                    "type": "error",
                    "code": "INVALID_JSON",
                    "message": "Invalid JSON format"
                }), websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.websocket("/ws/{user_id}")
async def websocket_user_endpoint_enhanced(websocket: WebSocket, user_id: str):
    """Enhanced user-specific WebSocket endpoint"""
    await manager.connect(websocket, user_id)
    try:
        # Send connection confirmation
        await manager.send_personal_message(json.dumps({
            "type": "connected",
            "sessionId": str(uuid.uuid4()),
            "serverTime": datetime.utcnow().isoformat()
        }), websocket)
        
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                action = message.get("action", "")
                
                if action == "subscribe":
                    channel = message.get("channel", "")
                    await manager.send_personal_message(json.dumps({
                        "type": "subscribed",
                        "channel": channel
                    }), websocket)
                else:
                    # Process and echo
                    await manager.send_personal_message(json.dumps({
                        "type": "message",
                        "userId": user_id,
                        "data": message
                    }), websocket)
            except json.JSONDecodeError:
                await manager.send_personal_message(json.dumps({
                    "type": "error",
                    "code": "INVALID_JSON",
                    "message": "Invalid JSON format"
                }), websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

# ============================================================================
# Kafka/MQTT Mock Endpoints (for testing without actual brokers)
# ============================================================================

@app.post("/api/kafka/produce")
async def kafka_produce(topic: str, message: Dict[str, Any]):
    """Mock Kafka producer endpoint"""
    return {
        "status": "success",
        "topic": topic,
        "partition": 0,
        "offset": int(time.time() * 1000),
        "message": message,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/kafka/consume")
async def kafka_consume(topic: str, limit: int = 10):
    """Mock Kafka consumer endpoint"""
    return {
        "status": "success",
        "topic": topic,
        "messages": [
            {
                "offset": i,
                "partition": 0,
                "value": {"test": "message", "id": i},
                "timestamp": datetime.utcnow().isoformat()
            }
            for i in range(limit)
        ]
    }

@app.post("/api/mqtt/publish")
async def mqtt_publish(topic: str, message: Dict[str, Any], qos: int = 1):
    """Mock MQTT publish endpoint"""
    return {
        "status": "success",
        "topic": topic,
        "qos": qos,
        "message": message,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/mqtt/subscribe")
async def mqtt_subscribe(topic: str, limit: int = 10):
    """Mock MQTT subscribe endpoint"""
    return {
        "status": "success",
        "topic": topic,
        "messages": [
            {
                "topic": topic,
                "payload": {"test": "message", "id": i},
                "qos": 1,
                "timestamp": datetime.utcnow().isoformat()
            }
            for i in range(limit)
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)

