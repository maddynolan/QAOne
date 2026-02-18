/**
 * Test Playground - Comprehensive Testing Environment
 * 
 * This page contains ALL complex UI scenarios for testing Flowstral capabilities:
 * - Dynamic product selection with pricing/tax calculations
 * - Tables with row actions
 * - iFrames for frame switching
 * - New tab/popup testing
 * - Downloadable PDFs
 * - Email verification flows
 * - Drag & drop, sliders, date pickers
 * - Multi-login flows
 * - Alerts, confirms, prompts
 * - Conditional visibility
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ShoppingCart, Package, CreditCard, Truck, User, Mail, Lock, 
  Download, ExternalLink, GripVertical, Calendar, Sliders,
  AlertTriangle, CheckCircle, XCircle, Eye, EyeOff, Table,
  Play, Trash2, Edit, Search, Plus, Minus, FileText, Frame
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// SAMPLE DATA
// ============================================================================

const PRODUCTS = [
  { id: 1, name: 'MacBook Pro 14"', price: 1999.99, category: 'Electronics', stock: 15, rating: 4.8, image: 'MB' },
  { id: 2, name: 'iPhone 15 Pro', price: 1199.00, category: 'Electronics', stock: 42, rating: 4.9, image: 'IP' },
  { id: 3, name: 'AirPods Pro 2', price: 249.00, category: 'Electronics', stock: 100, rating: 4.7, image: 'AP' },
  { id: 4, name: 'iPad Air', price: 599.00, category: 'Electronics', stock: 28, rating: 4.6, image: 'IA' },
  { id: 5, name: 'Apple Watch Ultra', price: 799.00, category: 'Electronics', stock: 8, rating: 4.8, image: 'AW' },
  { id: 6, name: 'Sony WH-1000XM5', price: 349.99, category: 'Audio', stock: 35, rating: 4.7, image: 'SN' },
  { id: 7, name: 'Samsung 4K TV 65"', price: 1299.00, category: 'Electronics', stock: 12, rating: 4.5, image: 'TV' },
  { id: 8, name: 'Nintendo Switch', price: 299.99, category: 'Gaming', stock: 55, rating: 4.8, image: 'NS' },
];

const ORDERS = [
  { id: 'ORD-10001', customer: 'John Smith', date: '2024-01-10', status: 'Delivered', total: 2199.99 },
  { id: 'ORD-10002', customer: 'Jane Doe', date: '2024-01-11', status: 'Shipped', total: 599.00 },
  { id: 'ORD-10003', customer: 'Bob Wilson', date: '2024-01-12', status: 'Processing', total: 1499.99 },
  { id: 'ORD-10004', customer: 'Alice Brown', date: '2024-01-13', status: 'Pending', total: 349.99 },
  { id: 'ORD-10005', customer: 'Charlie Davis', date: '2024-01-14', status: 'Cancelled', total: 799.00 },
];

const USERS = [
  { username: 'admin', password: 'Admin@123', role: 'Administrator', email: 'admin@flowstral.com' },
  { username: 'manager', password: 'Manager@123', role: 'Manager', email: 'manager@flowstral.com' },
  { username: 'user', password: 'User@123', role: 'Standard User', email: 'user@flowstral.com' },
  { username: 'guest', password: 'Guest@123', role: 'Guest', email: 'guest@flowstral.com' },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// Shared cart state type
type CartItem = typeof PRODUCTS[0] & { quantity: number };

export default function TestPlayground() {
  const [activeTab, setActiveTab] = useState('products');
  
  // Lifted cart state - shared between Products and Cart sections
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  
  const addToCart = (product: typeof PRODUCTS[0]) => {
    setCartItems(items => {
      const existing = items.find(item => item.id === product.id);
      if (existing) {
        return items.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...items, { ...product, quantity: 1 }];
    });
    toast.success(`Added ${product.name} to cart!`);
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-6 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Test Playground
          </h1>
          <p className="text-primary-foreground/70 mt-1">
            Comprehensive testing environment for all Flowstral capabilities
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 lg:grid-cols-10 gap-1 h-auto p-1 bg-white dark:bg-slate-800 shadow-sm">
            <TabsTrigger value="products" data-testid="tab-products" className="text-xs px-2 py-1.5">Products</TabsTrigger>
            {/* Cart tab with badge OUTSIDE the trigger to prevent text capture issues */}
            <div className="relative">
              <TabsTrigger value="cart" data-testid="tab-cart" className="text-xs px-2 py-1.5" aria-label="Cart">
                Cart
              </TabsTrigger>
              {cartItems.length > 0 && (
                <span 
                  className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center pointer-events-none" 
                  aria-hidden="true" 
                  data-testid="cart-count"
                >
                  {cartItems.length}
                </span>
              )}
            </div>
            <TabsTrigger value="tables" data-testid="tab-tables" className="text-xs px-2 py-1.5">Tables</TabsTrigger>
            <TabsTrigger value="forms" data-testid="tab-forms" className="text-xs px-2 py-1.5">Forms</TabsTrigger>
            <TabsTrigger value="login" data-testid="tab-login" className="text-xs px-2 py-1.5">Login</TabsTrigger>
            <TabsTrigger value="interactions" data-testid="tab-interactions" className="text-xs px-2 py-1.5">Interactions</TabsTrigger>
            <TabsTrigger value="frames" data-testid="tab-frames" className="text-xs px-2 py-1.5">Frames</TabsTrigger>
            <TabsTrigger value="downloads" data-testid="tab-downloads" className="text-xs px-2 py-1.5">Downloads</TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts" className="text-xs px-2 py-1.5">Alerts</TabsTrigger>
            <TabsTrigger value="advanced" data-testid="tab-advanced" className="text-xs px-2 py-1.5">Advanced</TabsTrigger>
          </TabsList>

          {/* Products Tab - Dynamic Selection & Pricing */}
          <TabsContent value="products">
            <ProductsSection addToCart={addToCart} cartItemCount={cartItems.length} />
          </TabsContent>

          {/* Cart Tab - Calculations & Checkout */}
          <TabsContent value="cart">
            <CartSection cartItems={cartItems} setCartItems={setCartItems} />
          </TabsContent>

          {/* Tables Tab - Row Operations */}
          <TabsContent value="tables">
            <TablesSection />
          </TabsContent>

          {/* Forms Tab - Complex Inputs */}
          <TabsContent value="forms">
            <FormsSection />
          </TabsContent>

          {/* Login Tab - Multi-User Authentication */}
          <TabsContent value="login">
            <LoginSection />
          </TabsContent>

          {/* Interactions Tab - Drag/Drop, Sliders, etc. */}
          <TabsContent value="interactions">
            <InteractionsSection />
          </TabsContent>

          {/* Frames Tab - iFrame Testing */}
          <TabsContent value="frames">
            <FramesSection />
          </TabsContent>

          {/* Downloads Tab - PDF & File Verification */}
          <TabsContent value="downloads">
            <DownloadsSection />
          </TabsContent>

          {/* Alerts Tab - JavaScript Dialogs */}
          <TabsContent value="alerts">
            <AlertsSection />
          </TabsContent>

          {/* Advanced Tab - Complex Scenarios */}
          <TabsContent value="advanced">
            <AdvancedSection />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ============================================================================
// PRODUCTS SECTION - Dynamic Selection & Smart Select Testing
// ============================================================================

interface ProductsSectionProps {
  addToCart: (product: typeof PRODUCTS[0]) => void;
  cartItemCount: number;
}

function ProductsSection({ addToCart, cartItemCount }: ProductsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000]);
  const [selectedProduct, setSelectedProduct] = useState<typeof PRODUCTS[0] | null>(null);

  const filteredProducts = PRODUCTS.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    const matchesPrice = p.price >= priceRange[0] && p.price <= priceRange[1];
    return matchesSearch && matchesCategory && matchesPrice;
  });

  const categories = [...new Set(PRODUCTS.map(p => p.category))];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-violet-500" />
          Product Catalog
        </CardTitle>
        <CardDescription>
          Test Smart Select by product name, filter by category, or search. Perfect for dynamic element selection testing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="grid md:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <div>
            <Label htmlFor="product-search-input">Search Products</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="product-search-input"
                name="product-search"
                data-testid="product-search"
                placeholder="Search products by name..."
                aria-label="Search products"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger data-testid="category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Min Price: ${priceRange[0]}</Label>
            <input
              type="range"
              min="0"
              max="2000"
              value={priceRange[0]}
              onChange={(e) => setPriceRange([parseInt(e.target.value), priceRange[1]])}
              className="w-full"
              data-testid="min-price-slider"
            />
          </div>
          <div>
            <Label>Max Price: ${priceRange[1]}</Label>
            <input
              type="range"
              min="0"
              max="2000"
              value={priceRange[1]}
              onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
              className="w-full"
              data-testid="max-price-slider"
            />
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              data-product-id={product.id}
              data-product-name={product.name}
              data-product-price={product.price}
              data-product-stock={product.stock}
              className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-lg ${
                selectedProduct?.id === product.id ? 'ring-2 ring-violet-500 bg-violet-50' : 'bg-white dark:bg-slate-800'
              }`}
              onClick={() => setSelectedProduct(product)}
            >
              <div className="text-4xl mb-2">{product.image}</div>
              <h3 className="font-semibold text-sm">{product.name}</h3>
              <p className="text-xs text-muted-foreground">{product.category}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-lg font-bold text-violet-600" data-testid={`price-${product.id}`}>
                  ${product.price.toFixed(2)}
                </span>
                <Badge variant={product.stock > 20 ? 'default' : product.stock > 0 ? 'secondary' : 'destructive'}>
                  {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                </Badge>
              </div>
              <div className="flex items-center gap-1 mt-2 text-yellow-500">
                {'★'.repeat(Math.floor(product.rating))}
                <span className="text-xs text-muted-foreground">({product.rating})</span>
              </div>
              <Button 
                className="w-full mt-3" 
                size="sm"
                data-testid={`add-to-cart-${product.id}`}
                disabled={product.stock === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  addToCart(product);
                }}
              >
                <ShoppingCart className="h-4 w-4 mr-1" />
                Add to Cart
              </Button>
            </div>
          ))}
        </div>

        {/* Selected Product Info */}
        {selectedProduct && (
          <div className="mt-6 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200">
            <h4 className="font-semibold text-violet-700 dark:text-violet-300">Selected Product</h4>
            <div className="grid grid-cols-4 gap-4 mt-2 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>
                <p className="font-medium" data-testid="selected-product-name">{selectedProduct.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Price:</span>
                <p className="font-medium" data-testid="selected-product-price">${selectedProduct.price.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Stock:</span>
                <p className="font-medium" data-testid="selected-product-stock">{selectedProduct.stock}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Rating:</span>
                <p className="font-medium" data-testid="selected-product-rating">{selectedProduct.rating}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CART SECTION - Pricing Calculations Testing
// ============================================================================

interface CartSectionProps {
  cartItems: CartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
}

function CartSection({ cartItems, setCartItems }: CartSectionProps) {
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [shippingMethod, setShippingMethod] = useState('standard');

  const shippingCosts: Record<string, number> = {
    standard: 9.99,
    express: 19.99,
    overnight: 39.99,
    free: 0,
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = shippingCosts[shippingMethod];
  const taxRate = 0.0825; // 8.25%
  const tax = (subtotal - discount) * taxRate;
  const total = subtotal - discount + shipping + tax;

  const applyPromo = () => {
    if (promoCode.toUpperCase() === 'SAVE10') {
      setDiscount(subtotal * 0.1);
      toast.success('10% discount applied!');
    } else if (promoCode.toUpperCase() === 'SAVE20') {
      setDiscount(subtotal * 0.2);
      toast.success('20% discount applied!');
    } else if (promoCode.toUpperCase() === 'FLAT50') {
      setDiscount(50);
      toast.success('$50 discount applied!');
    } else {
      toast.error('Invalid promo code');
    }
  };

  const updateQuantity = (id: number, delta: number) => {
    setCartItems(items => 
      items.map(item => 
        item.id === id 
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
    setDiscount(0); // Reset discount when cart changes
  };

  const removeItem = (id: number) => {
    setCartItems(items => items.filter(item => item.id !== id));
    setDiscount(0);
    toast.info('Item removed from cart');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-violet-500" />
          Shopping Cart & Checkout
        </CardTitle>
        <CardDescription>
          Test computed assertions: subtotal × quantity, tax calculations, discount application.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-semibold">Cart Items</h3>
            {cartItems.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-lg border-2 border-dashed">
                <ShoppingCart className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Your cart is empty</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Go to Products tab to add items</p>
              </div>
            ) : null}
            {cartItems.map(item => (
              <div key={item.id} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-lg border" data-cart-item={item.id}>
                <div className="text-3xl">{item.image}</div>
                <div className="flex-1">
                  <h4 className="font-medium" data-testid={`cart-item-name-${item.id}`}>{item.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Unit Price: <span data-testid={`cart-item-price-${item.id}`}>${item.price.toFixed(2)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, -1)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-medium" data-testid={`cart-item-qty-${item.id}`}>{item.quantity}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, 1)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-right">
                  <p className="font-bold" data-testid={`cart-item-total-${item.id}`}>
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-500 hover:text-red-700 hover:bg-red-50" 
                    onClick={() => removeItem(item.id)}
                    data-testid={`remove-item-${item.id}`}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="space-y-4">
            <h3 className="font-semibold">Order Summary</h3>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-3">
              {/* Promo Code */}
              <div className="flex gap-2">
                <Label htmlFor="promo-code" className="sr-only">Promo Code</Label>
                <Input 
                  id="promo-code"
                  name="promo-code"
                  placeholder="Enter promo code (SAVE10, SAVE20, FLAT50)"
                  aria-label="Promo code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  data-testid="promo-code-input"
                />
                <Button onClick={applyPromo} data-testid="apply-promo" name="apply-promo">
                  Apply
                </Button>
              </div>

              {/* Shipping */}
              <div>
                <Label>Shipping Method</Label>
                <Select value={shippingMethod} onValueChange={setShippingMethod}>
                  <SelectTrigger data-testid="shipping-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard ($9.99)</SelectItem>
                    <SelectItem value="express">Express ($19.99)</SelectItem>
                    <SelectItem value="overnight">Overnight ($39.99)</SelectItem>
                    <SelectItem value="free">Free Shipping</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Totals */}
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span data-testid="cart-subtotal">${subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span data-testid="cart-discount">-${discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Shipping:</span>
                  <span data-testid="cart-shipping">${shipping.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (8.25%):</span>
                  <span data-testid="cart-tax">${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span data-testid="cart-total">${total.toFixed(2)}</span>
                </div>
              </div>

              <Button 
                className="w-full" 
                size="lg" 
                data-testid="checkout-button"
                onClick={() => {
                  if (cartItems.length === 0) {
                    toast.error('Your cart is empty!');
                    return;
                  }
                  toast.success(`Order placed! Total: $${total.toFixed(2)}`);
                  setCartItems([]);
                  setDiscount(0);
                  setPromoCode('');
                }}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Proceed to Checkout
              </Button>
            </div>

            {/* Calculation Reference */}
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs">
              <p className="font-semibold text-amber-700 dark:text-amber-300">💡 Test Assertions:</p>
              <ul className="mt-1 space-y-1 text-amber-600 dark:text-amber-400">
                <li>• Subtotal = Σ(price × qty) = ${subtotal.toFixed(2)}</li>
                <li>• Tax = (Subtotal - Discount) × 0.0825</li>
                <li>• Total = Subtotal - Discount + Shipping + Tax</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// TABLES SECTION - Table Operations Testing
// ============================================================================

function TablesSection() {
  const [searchOrder, setSearchOrder] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'total'>('date');
  const [editingOrder, setEditingOrder] = useState<string | null>(null);

  const filteredOrders = ORDERS.filter(o => 
    o.id.toLowerCase().includes(searchOrder.toLowerCase()) ||
    o.customer.toLowerCase().includes(searchOrder.toLowerCase())
  ).sort((a, b) => sortBy === 'date' ? b.date.localeCompare(a.date) : b.total - a.total);

  const statusColors: Record<string, string> = {
    'Delivered': 'bg-green-100 text-green-800',
    'Shipped': 'bg-blue-100 text-blue-800',
    'Processing': 'bg-yellow-100 text-yellow-800',
    'Pending': 'bg-orange-100 text-orange-800',
    'Cancelled': 'bg-red-100 text-red-800',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Table className="h-5 w-5 text-violet-500" />
          Orders Table
        </CardTitle>
        <CardDescription>
          Test Table Find (find row by Order ID), Table Extract (get row data), and row actions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Input
              placeholder="Search by Order ID or Customer..."
              value={searchOrder}
              onChange={(e) => setSearchOrder(e.target.value)}
              data-testid="order-search"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'date' | 'total')}>
            <SelectTrigger className="w-40" data-testid="sort-orders">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Sort by Date</SelectItem>
              <SelectItem value="total">Sort by Total</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-auto">
          <table className="min-w-max w-full" data-testid="orders-table">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Order ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Customer</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Total</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50" data-order-id={order.id}>
                  <td className="px-4 py-3 font-mono text-sm">{order.id}</td>
                  <td className="px-4 py-3">{order.customer}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{order.date}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">${order.total.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        data-testid={`view-${order.id}`}
                        onClick={() => toast.info(`Viewing ${order.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        data-testid={`edit-${order.id}`}
                        onClick={() => setEditingOrder(order.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-500"
                        data-testid={`delete-${order.id}`}
                        onClick={() => toast.error(`Deleted ${order.id}`)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Edit Modal */}
        {editingOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingOrder(null)}>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Edit Order {editingOrder}</h3>
              <div className="space-y-4">
                <div>
                  <Label>Status</Label>
                  <Select defaultValue={ORDERS.find(o => o.id === editingOrder)?.status}>
                    <SelectTrigger data-testid="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Processing">Processing</SelectItem>
                      <SelectItem value="Shipped">Shipped</SelectItem>
                      <SelectItem value="Delivered">Delivered</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => { setEditingOrder(null); toast.success('Order updated!'); }}>
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setEditingOrder(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// FORMS SECTION - Complex Form Testing
// ============================================================================

function FormsSection() {
  const [country, setCountry] = useState('');
  const [showStateField, setShowStateField] = useState(false);
  const [cardType, setCardType] = useState('');

  useEffect(() => {
    setShowStateField(country === 'US' || country === 'CA');
  }, [country]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-violet-500" />
          Complex Forms
        </CardTitle>
        <CardDescription>
          Test conditional field visibility, multi-select, date pickers, and form validation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Shipping Form */}
          <div className="space-y-4">
            <h3 className="font-semibold">Shipping Address</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name *</Label>
                <Input data-testid="first-name" placeholder="John" />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input data-testid="last-name" placeholder="Doe" />
              </div>
            </div>
            <div>
              <Label>Email *</Label>
              <Input data-testid="email" type="email" placeholder="john@example.com" />
            </div>
            <div>
              <Label>Country *</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger data-testid="country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                  <SelectItem value="UK">United Kingdom</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {showStateField && (
              <div data-testid="state-field-container">
                <Label>State/Province *</Label>
                <Select>
                  <SelectTrigger data-testid="state">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {country === 'US' ? (
                      <>
                        <SelectItem value="CA">California</SelectItem>
                        <SelectItem value="NY">New York</SelectItem>
                        <SelectItem value="TX">Texas</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="ON">Ontario</SelectItem>
                        <SelectItem value="BC">British Columbia</SelectItem>
                        <SelectItem value="QC">Quebec</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Delivery Date</Label>
              <Input type="date" data-testid="delivery-date" />
            </div>
            <div>
              <Label>Delivery Time Preference</Label>
              <select 
                multiple 
                className="w-full h-24 border rounded-md p-2"
                data-testid="delivery-time-multi"
              >
                <option value="morning">Morning (8am - 12pm)</option>
                <option value="afternoon">Afternoon (12pm - 5pm)</option>
                <option value="evening">Evening (5pm - 9pm)</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>
          </div>

          {/* Payment Form */}
          <div className="space-y-4">
            <h3 className="font-semibold">Payment Details</h3>
            <div>
              <Label>Card Type</Label>
              <Select value={cardType} onValueChange={setCardType}>
                <SelectTrigger data-testid="card-type">
                  <SelectValue placeholder="Select card type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visa">Visa</SelectItem>
                  <SelectItem value="mastercard">Mastercard</SelectItem>
                  <SelectItem value="amex">American Express</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Card Number</Label>
              <Input 
                data-testid="card-number" 
                placeholder={cardType === 'amex' ? '3XXX XXXXXX XXXXX' : 'XXXX XXXX XXXX XXXX'} 
                maxLength={cardType === 'amex' ? 17 : 19}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Expiry Date</Label>
                <Input data-testid="card-expiry" placeholder="MM/YY" />
              </div>
              <div>
                <Label>CVV</Label>
                <Input 
                  data-testid="card-cvv" 
                  placeholder={cardType === 'amex' ? '4 digits' : '3 digits'} 
                  maxLength={cardType === 'amex' ? 4 : 3}
                  type="password"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="save-card" data-testid="save-card" />
              <Label htmlFor="save-card">Save card for future purchases</Label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="billing-same" data-testid="billing-same" defaultChecked />
              <Label htmlFor="billing-same">Billing address same as shipping</Label>
            </div>
            <Button className="w-full" data-testid="submit-payment">
              <CreditCard className="h-4 w-4 mr-2" />
              Pay Now
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// LOGIN SECTION - Multi-User Authentication Testing
// ============================================================================

function LoginSection() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<typeof USERS[0] | null>(null);
  const [loginError, setLoginError] = useState('');

  const handleLogin = () => {
    const user = USERS.find(u => u.username === username && u.password === password);
    if (user) {
      setLoggedInUser(user);
      setLoginError('');
      toast.success(`Welcome, ${user.username}! Role: ${user.role}`);
    } else {
      setLoginError('Invalid username or password');
      toast.error('Login failed');
    }
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    setUsername('');
    setPassword('');
    toast.info('Logged out successfully');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-violet-500" />
          Multi-User Login System
        </CardTitle>
        <CardDescription>
          Test multi-login flows with different user roles. Each role sees different content.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Login Form */}
          <div className="space-y-4">
            <h3 className="font-semibold">Login</h3>
            {loggedInUser ? (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center text-white text-xl">
                    {loggedInUser.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold" data-testid="logged-in-user">{loggedInUser.username}</p>
                    <p className="text-sm text-muted-foreground" data-testid="logged-in-role">{loggedInUser.role}</p>
                    <p className="text-xs text-muted-foreground">{loggedInUser.email}</p>
                  </div>
                </div>
                <Button className="w-full mt-4" variant="outline" onClick={handleLogout} data-testid="logout-button">
                  Logout
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <Label>Username</Label>
                  <Input
                    data-testid="login-username"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      data-testid="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {loginError && (
                  <p className="text-red-500 text-sm" data-testid="login-error">{loginError}</p>
                )}
                <Button className="w-full" onClick={handleLogin} data-testid="login-button">
                  <Lock className="h-4 w-4 mr-2" />
                  Login
                </Button>
              </>
            )}
          </div>

          {/* Test Credentials */}
          <div className="space-y-4">
            <h3 className="font-semibold">Test Credentials</h3>
            <div className="space-y-2">
              {USERS.map(user => (
                <div 
                  key={user.username} 
                  className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  onClick={() => {
                    setUsername(user.username);
                    setPassword(user.password);
                  }}
                  data-testid={`creds-${user.username}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{user.username}</p>
                      <p className="text-xs text-muted-foreground">{user.role}</p>
                    </div>
                    <Badge variant="outline">{user.password}</Badge>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Click on any credential to auto-fill the login form
            </p>
          </div>

          {/* Role-Based Content */}
          {loggedInUser && (
            <div className="md:col-span-2">
              <h3 className="font-semibold mb-4">Role-Based Dashboard</h3>
              <div className="p-4 border rounded-lg" data-testid="role-dashboard">
                {loggedInUser.role === 'Administrator' && (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 bg-red-50 rounded-lg text-center">
                      <p className="text-2xl font-bold">156</p>
                      <p className="text-sm text-muted-foreground">Total Users</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <p className="text-2xl font-bold">1,234</p>
                      <p className="text-sm text-muted-foreground">Orders</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      <p className="text-2xl font-bold">$89K</p>
                      <p className="text-sm text-muted-foreground">Revenue</p>
                    </div>
                    <div className="p-4 bg-yellow-50 rounded-lg text-center">
                      <p className="text-2xl font-bold">98%</p>
                      <p className="text-sm text-muted-foreground">Uptime</p>
                    </div>
                  </div>
                )}
                {loggedInUser.role === 'Manager' && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <p className="text-2xl font-bold">45</p>
                      <p className="text-sm text-muted-foreground">Pending Orders</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      <p className="text-2xl font-bold">12</p>
                      <p className="text-sm text-muted-foreground">Team Members</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg text-center">
                      <p className="text-2xl font-bold">8</p>
                      <p className="text-sm text-muted-foreground">Reports</p>
                    </div>
                  </div>
                )}
                {loggedInUser.role === 'Standard User' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      <p className="text-2xl font-bold">5</p>
                      <p className="text-sm text-muted-foreground">My Orders</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <p className="text-2xl font-bold">2</p>
                      <p className="text-sm text-muted-foreground">Wishlist Items</p>
                    </div>
                  </div>
                )}
                {loggedInUser.role === 'Guest' && (
                  <div className="text-center p-4 bg-slate-50 rounded-lg">
                    <p className="text-muted-foreground">Limited access. Please upgrade your account.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// INTERACTIONS SECTION - Drag/Drop, Sliders, etc.
// ============================================================================

function InteractionsSection() {
  const [sliderValue, setSliderValue] = useState(50);
  const [rangeMin, setRangeMin] = useState(20);
  const [rangeMax, setRangeMax] = useState(80);
  const [dragItems, setDragItems] = useState(['Item 1', 'Item 2', 'Item 3', 'Item 4']);
  const [dropZone, setDropZone] = useState<string[]>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const handleDragStart = (item: string) => {
    setDraggedItem(item);
  };

  const handleDrop = () => {
    if (draggedItem) {
      setDropZone([...dropZone, draggedItem]);
      setDragItems(dragItems.filter(i => i !== draggedItem));
      setDraggedItem(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sliders className="h-5 w-5 text-violet-500" />
          Complex UI Interactions
        </CardTitle>
        <CardDescription>
          Test drag & drop, sliders, date pickers, and other complex UI elements.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Sliders */}
          <div className="space-y-6">
            <h3 className="font-semibold">Sliders</h3>
            
            <div>
              <Label>Simple Slider: {sliderValue}</Label>
              <input
                type="range"
                min="0"
                max="100"
                value={sliderValue}
                onChange={(e) => setSliderValue(parseInt(e.target.value))}
                className="w-full"
                data-testid="simple-slider"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            <div>
              <Label>Price Range: ${rangeMin} - ${rangeMax}</Label>
              <div className="flex gap-4 items-center">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={rangeMin}
                  onChange={(e) => setRangeMin(Math.min(parseInt(e.target.value), rangeMax - 10))}
                  className="flex-1"
                  data-testid="range-min-slider"
                />
                <span className="text-sm text-muted-foreground">to</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={rangeMax}
                  onChange={(e) => setRangeMax(Math.max(parseInt(e.target.value), rangeMin + 10))}
                  className="flex-1"
                  data-testid="range-max-slider"
                />
              </div>
            </div>

            <div>
              <Label>Date Selection</Label>
              <Input type="date" data-testid="date-picker" />
            </div>

            <div>
              <Label>DateTime Selection</Label>
              <Input type="datetime-local" data-testid="datetime-picker" />
            </div>

            <div>
              <Label>Color Picker</Label>
              <input type="color" className="w-full h-10 rounded cursor-pointer" data-testid="color-picker" defaultValue="#8b5cf6" />
            </div>
          </div>

          {/* Drag and Drop */}
          <div className="space-y-4">
            <h3 className="font-semibold">Drag & Drop</h3>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Source */}
              <div>
                <Label>Drag Items</Label>
                <div className="border-2 border-dashed rounded-lg p-4 min-h-[200px] bg-slate-50 dark:bg-slate-800/50" data-testid="drag-source">
                  {dragItems.map(item => (
                    <div
                      key={item}
                      draggable
                      onDragStart={() => handleDragStart(item)}
                      className="p-3 mb-2 bg-white dark:bg-slate-700 rounded border cursor-move flex items-center gap-2 hover:shadow-md transition-shadow"
                      data-testid={`draggable-${item.replace(' ', '-').toLowerCase()}`}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      {item}
                    </div>
                  ))}
                  {dragItems.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm">No items left</p>
                  )}
                </div>
              </div>

              {/* Target */}
              <div>
                <Label>Drop Zone</Label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-violet-300 rounded-lg p-4 min-h-[200px] bg-violet-50 dark:bg-violet-900/20"
                  data-testid="drop-zone"
                >
                  {dropZone.map(item => (
                    <div
                      key={item}
                      className="p-3 mb-2 bg-violet-100 dark:bg-violet-800 rounded border border-violet-200"
                    >
                      <CheckCircle className="h-4 w-4 text-green-500 inline mr-2" />
                      {item}
                    </div>
                  ))}
                  {dropZone.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm">Drop items here</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDragItems(['Item 1', 'Item 2', 'Item 3', 'Item 4']);
                  setDropZone([]);
                }}
                data-testid="reset-drag-drop"
              >
                Reset
              </Button>
              <span className="text-sm text-muted-foreground self-center">
                Dropped: {dropZone.length} items
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// FRAMES SECTION - iFrame Testing
// ============================================================================

function FramesSection() {
  const [frameUrl, setFrameUrl] = useState('https://example.com');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Frame className="h-5 w-5 text-violet-500" />
          iFrame Testing
        </CardTitle>
        <CardDescription>
          Test frame switching - interact with elements inside iframes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Frame URL Selector */}
          <div className="flex gap-4">
            <Select value={frameUrl} onValueChange={setFrameUrl}>
              <SelectTrigger className="w-64" data-testid="frame-url-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="https://example.com">Example.com</SelectItem>
                <SelectItem value="about:blank">Blank Page</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => window.open(frameUrl, '_blank')}
              data-testid="open-in-new-tab"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
          </div>

          {/* Local iFrame with Form */}
          <div>
            <Label>Embedded Form (Local iFrame)</Label>
            <div className="border rounded-lg overflow-hidden">
              <iframe
                id="payment-frame"
                name="payment-frame"
                srcDoc={`
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <style>
                      body { font-family: system-ui; padding: 20px; background: #f8f9fa; margin: 0; }
                      .form-group { margin-bottom: 15px; }
                      label { display: block; margin-bottom: 5px; font-weight: 500; }
                      input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; }
                      input:focus { outline: 2px solid #8b5cf6; border-color: #8b5cf6; }
                      button { background: #8b5cf6; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; width: 100%; font-weight: 500; }
                      button:hover { background: #7c3aed; }
                      .title { color: #8b5cf6; margin-bottom: 20px; }
                    </style>
                  </head>
                  <body>
                    <h3 class="title">💳 Payment Form (Inside iFrame)</h3>
                    <div class="form-group">
                      <label>Card Number</label>
                      <input type="text" id="iframe-card" placeholder="4242 4242 4242 4242" data-testid="iframe-card-input" />
                    </div>
                    <div class="form-group">
                      <label>Expiry</label>
                      <input type="text" id="iframe-expiry" placeholder="MM/YY" data-testid="iframe-expiry-input" />
                    </div>
                    <div class="form-group">
                      <label>CVV</label>
                      <input type="password" id="iframe-cvv" placeholder="123" data-testid="iframe-cvv-input" />
                    </div>
                    <button type="button" onclick="alert('Payment submitted from iFrame!')" data-testid="iframe-submit">
                      Submit Payment
                    </button>
                  </body>
                  </html>
                `}
                className="w-full h-[400px]"
                data-testid="payment-iframe"
              />
            </div>
          </div>

          {/* External iFrame */}
          <div>
            <Label>External Content iFrame</Label>
            <div className="border rounded-lg overflow-hidden bg-white">
              <iframe
                id="external-frame"
                name="external-frame"
                src={frameUrl}
                className="w-full h-[300px]"
                data-testid="external-iframe"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// DOWNLOADS SECTION - PDF & File Verification
// ============================================================================

function DownloadsSection() {
  const generatePDF = (type: string) => {
    // Create a simple PDF-like text file for demo
    const content = type === 'invoice' 
      ? `INVOICE #INV-2024-001
      
Date: ${new Date().toLocaleDateString()}
Customer: John Doe

Items:
- MacBook Pro 14" - $1,999.99
- AirPods Pro 2 - $249.00

Subtotal: $2,248.99
Tax (8.25%): $185.54
Total: $2,434.53

Thank you for your purchase!`
      : `ORDER CONFIRMATION
      
Order ID: ORD-${Date.now()}
Date: ${new Date().toLocaleDateString()}
Status: Confirmed

Shipping to:
John Doe
123 Test Street
San Francisco, CA 94105

Expected Delivery: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}`;

    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-${Date.now()}.pdf`;
    a.click();
    toast.success(`${type}.pdf downloaded!`);
  };

  const generateCSV = () => {
    const csv = `Order ID,Customer,Date,Status,Total
ORD-10001,John Smith,2024-01-10,Delivered,2199.99
ORD-10002,Jane Doe,2024-01-11,Shipped,599.00
ORD-10003,Bob Wilson,2024-01-12,Processing,1499.99`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-export-${Date.now()}.csv`;
    a.click();
    toast.success('CSV exported!');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-violet-500" />
          File Downloads & Verification
        </CardTitle>
        <CardDescription>
          Test PDF verification, CSV exports, and file download assertions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* PDF Downloads */}
          <div className="space-y-4">
            <h3 className="font-semibold">PDF Documents</h3>
            <div className="space-y-3">
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => generatePDF('invoice')}
                data-testid="download-invoice-pdf"
              >
                <FileText className="h-4 w-4 mr-2 text-red-500" />
                Download Invoice (PDF)
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => generatePDF('order-confirmation')}
                data-testid="download-confirmation-pdf"
              >
                <FileText className="h-4 w-4 mr-2 text-blue-500" />
                Download Order Confirmation (PDF)
              </Button>
            </div>
            
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs">
              <p className="font-semibold text-amber-700">💡 PDF Verify Test:</p>
              <ul className="mt-1 space-y-1 text-amber-600">
                <li>• Verify PDF contains "INVOICE"</li>
                <li>• Extract total amount from PDF</li>
                <li>• Verify page count = 1</li>
              </ul>
            </div>
          </div>

          {/* CSV/Excel Downloads */}
          <div className="space-y-4">
            <h3 className="font-semibold">Data Exports</h3>
            <div className="space-y-3">
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={generateCSV}
                data-testid="download-csv"
              >
                <Table className="h-4 w-4 mr-2 text-green-500" />
                Export Orders (CSV)
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => toast.info('Excel export would happen here')}
                data-testid="download-excel"
              >
                <Table className="h-4 w-4 mr-2 text-green-600" />
                Export Orders (Excel)
              </Button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs">
              <p className="font-semibold text-amber-700">💡 File Verify Test:</p>
              <ul className="mt-1 space-y-1 text-amber-600">
                <li>• Verify CSV has 4 rows (header + 3 data)</li>
                <li>• Verify column "Total" exists</li>
                <li>• Sum of Total column = 4298.98</li>
              </ul>
            </div>
          </div>

          {/* Email Testing Section */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="font-semibold">Email Verification Testing</h3>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Email for Order Confirmation</Label>
                  <div className="flex gap-2">
                    <Input type="email" placeholder="test@example.com" data-testid="email-for-order" />
                    <Button data-testid="send-order-email" onClick={() => toast.success('Order confirmation email sent!')}>
                      <Mail className="h-4 w-4 mr-2" />
                      Send
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Email for Password Reset</Label>
                  <div className="flex gap-2">
                    <Input type="email" placeholder="test@example.com" data-testid="email-for-reset" />
                    <Button variant="outline" data-testid="send-reset-email" onClick={() => toast.success('Password reset email sent!')}>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Reset
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs">
                <p className="font-semibold text-amber-700">💡 Email Verify Test:</p>
                <ul className="mt-1 space-y-1 text-amber-600">
                  <li>• Wait for email with subject "Order Confirmation"</li>
                  <li>• Verify email contains order ID</li>
                  <li>• Extract OTP code from email body</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ALERTS SECTION - JavaScript Dialogs
// ============================================================================

function AlertsSection() {
  const [promptResult, setPromptResult] = useState<string | null>(null);
  const [confirmResult, setConfirmResult] = useState<boolean | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-violet-500" />
          JavaScript Dialogs
        </CardTitle>
        <CardDescription>
          Test alert handling - accept, dismiss, get text, and type into prompts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-6">
          {/* Alert */}
          <div className="space-y-4">
            <h3 className="font-semibold">Alert</h3>
            <Button
              className="w-full"
              onClick={() => alert('This is a test alert message!')}
              data-testid="trigger-alert"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Show Alert
            </Button>
            <p className="text-xs text-muted-foreground">
              Test: Accept the alert (OK button)
            </p>
          </div>

          {/* Confirm */}
          <div className="space-y-4">
            <h3 className="font-semibold">Confirm</h3>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                const result = confirm('Do you want to proceed?');
                setConfirmResult(result);
              }}
              data-testid="trigger-confirm"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Show Confirm
            </Button>
            {confirmResult !== null && (
              <p className="text-sm">
                Result: <Badge variant={confirmResult ? 'default' : 'destructive'}>
                  {confirmResult ? 'Accepted' : 'Dismissed'}
                </Badge>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Test: Accept or Dismiss the confirm dialog
            </p>
          </div>

          {/* Prompt */}
          <div className="space-y-4">
            <h3 className="font-semibold">Prompt</h3>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => {
                const result = prompt('Enter your name:', 'John Doe');
                setPromptResult(result);
              }}
              data-testid="trigger-prompt"
            >
              <Edit className="h-4 w-4 mr-2" />
              Show Prompt
            </Button>
            {promptResult !== null && (
              <p className="text-sm">
                Entered: <Badge variant="outline">{promptResult || '(empty)'}</Badge>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Test: Type into prompt and accept
            </p>
          </div>
        </div>

        {/* Multiple Alerts Chain */}
        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <h3 className="font-semibold mb-4">Alert Chain Test</h3>
          <Button
            onClick={() => {
              alert('Step 1: Welcome!');
              const proceed = confirm('Step 2: Continue to payment?');
              if (proceed) {
                const name = prompt('Step 3: Enter cardholder name:');
                if (name) {
                  alert(`Step 4: Thank you, ${name}! Payment complete.`);
                }
              }
            }}
            data-testid="trigger-alert-chain"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Alert Chain (4 steps)
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Tests handling multiple sequential dialogs
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ADVANCED SECTION - Complex Scenarios
// ============================================================================

function AdvancedSection() {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🚀 Advanced Test Scenarios
        </CardTitle>
        <CardDescription>
          Complex combinations for thorough testing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* New Tab / Popup Testing */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <h3 className="font-semibold mb-4">New Tab & Popup Windows</h3>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => window.open('https://www.google.com', '_blank')}
                data-testid="open-new-tab"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open New Tab
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open('https://example.com', 'popup', 'width=600,height=400')}
                data-testid="open-popup"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Popup Window
              </Button>
              <a 
                href="https://github.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border rounded-md hover:bg-slate-100"
                data-testid="link-new-tab"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Link to New Tab
              </a>
            </div>
          </div>

          {/* Multi-Select Checkboxes */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <h3 className="font-semibold mb-4">Multi-Select Checkboxes</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['Email Notifications', 'SMS Alerts', 'Push Notifications', 'Weekly Digest', 
                'Order Updates', 'Promotional Offers', 'Security Alerts', 'Newsletter'].map(option => (
                <label key={option} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(option)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOptions([...selectedOptions, option]);
                      } else {
                        setSelectedOptions(selectedOptions.filter(o => o !== option));
                      }
                    }}
                    data-testid={`checkbox-${option.toLowerCase().replace(/\s+/g, '-')}`}
                  />
                  <span className="text-sm">{option}</span>
                </label>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Selected: {selectedOptions.length > 0 ? selectedOptions.join(', ') : 'None'}
            </p>
          </div>

          {/* Keyboard Shortcuts Test */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <h3 className="font-semibold mb-4">Keyboard Interaction Test</h3>
            <div className="space-y-3">
              <div>
                <Label>Press keys in this input:</Label>
                <Input
                  placeholder="Try: Enter, Tab, Escape, Arrow keys, Ctrl+A"
                  data-testid="keyboard-test-input"
                  onKeyDown={(e) => {
                    const key = e.key;
                    const mods = [];
                    if (e.ctrlKey) mods.push('Ctrl');
                    if (e.shiftKey) mods.push('Shift');
                    if (e.altKey) mods.push('Alt');
                    const combo = [...mods, key].join('+');
                    toast.info(`Key pressed: ${combo}`);
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Test keyboard step by pressing various key combinations
              </p>
            </div>
          </div>

          {/* Conditional Visibility Test */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <h3 className="font-semibold mb-4">Conditional Field Visibility</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show-advanced"
                  data-testid="toggle-advanced-fields"
                />
                <Label htmlFor="show-advanced">Show advanced options</Label>
              </div>
              <div id="advanced-options" className="hidden peer-checked:block">
                <div className="p-4 bg-violet-50 rounded-lg space-y-3" data-testid="advanced-fields-container">
                  <p className="text-sm font-medium text-violet-700">Advanced Options (conditionally visible)</p>
                  <Input placeholder="Advanced setting 1" data-testid="advanced-setting-1" />
                  <Input placeholder="Advanced setting 2" data-testid="advanced-setting-2" />
                </div>
              </div>
            </div>
          </div>

          {/* Testing Checklist */}
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h3 className="font-semibold text-green-700 dark:text-green-400 mb-3">✅ Test Coverage Checklist</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium">Dynamic Selection</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>☑️ Smart Select by text</li>
                  <li>☑️ Smart Select by attribute</li>
                  <li>☑️ Filter & search products</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">Calculations</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>☑️ Cart total verification</li>
                  <li>☑️ Tax calculation (8.25%)</li>
                  <li>☑️ Discount application</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">Complex UI</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>☑️ Drag & drop</li>
                  <li>☑️ Sliders & ranges</li>
                  <li>☑️ Date/time pickers</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">Tables</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>☑️ Find row by column</li>
                  <li>☑️ Row actions (Edit/Delete)</li>
                  <li>☑️ Sort & filter</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">Multi-Context</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>☑️ iFrame switching</li>
                  <li>☑️ New tab handling</li>
                  <li>☑️ Alert/Confirm/Prompt</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">Verification</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>☑️ PDF download & verify</li>
                  <li>☑️ CSV export verify</li>
                  <li>☑️ Email triggers</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
