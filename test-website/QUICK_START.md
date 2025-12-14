# Quick Start Guide

Get the test website up and running in 5 minutes!

## Prerequisites Check

```bash
# Check Python version (need 3.9+)
python --version

# Check Node.js version (need 18+)
node --version

# Check npm version
npm --version
```

## Option 1: Automated Start (Recommended)

### Windows
```bash
cd test-website
start.bat
```

### Linux/Mac
```bash
cd test-website
chmod +x start.sh
./start.sh
```

## Option 2: Manual Start

### Step 1: Start Backend

```bash
cd test-website/backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
python main.py
```

Backend will start on `http://localhost:8001`

### Step 2: Start Frontend (New Terminal)

```bash
cd test-website/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend will start on `http://localhost:3000`

## Verify Installation

1. **Backend Health Check:**
   - Open browser: `http://localhost:8001/health`
   - Should see: `{"status": "healthy", ...}`

2. **Backend API Docs:**
   - Open browser: `http://localhost:8001/docs`
   - Should see Swagger UI

3. **Frontend:**
   - Open browser: `http://localhost:3000`
   - Should see the test website homepage

## Test Login

1. Go to `http://localhost:3000/login`
2. Use test credentials:
   - **Admin**: `admin` / `Admin@2024!Secure#Test`
   - **User**: `testuser` / `TestUser@2024!Secure#Pass`

## First Test

1. Login with test credentials
2. Navigate to Products page
3. Search for "Product"
4. Add a product to cart
5. Go to Cart
6. Proceed to Checkout
7. Fill form and place order

## Troubleshooting

### Backend won't start
- Check if port 8001 is available
- Verify Python 3.9+ is installed
- Check virtual environment is activated
- Verify all dependencies installed: `pip list`

### Frontend won't start
- Check if port 3000 is available
- Verify Node.js 18+ is installed
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check for errors in terminal

### Database issues
- Delete `test_website.db` to reset database
- Backend will auto-create database on first run

### API connection errors
- Verify backend is running on port 8001
- Check CORS settings in backend
- Verify `.env` file in frontend has correct API URL

## Next Steps

1. Read `README.md` for full documentation
2. Read `API_TESTING_GUIDE.md` for API testing examples
3. Read `TESTING_SCENARIOS.md` for comprehensive test scenarios
4. Start testing with Flowstral, Nexus, and API testing tools!

---

**You're all set! Happy testing! 🚀**


