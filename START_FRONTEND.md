# 🚀 How to Start Frontend

## Location

The frontend is in the **ROOT directory** (`C:\QAAI`), NOT in a `frontend/` subdirectory.

## Quick Start

```bash
# From project root (C:\QAAI)
npm run dev
```

Frontend will start on: **http://localhost:8080**

## If You Get Errors

### Missing Dependencies
```bash
npm install
```

### Port Already in Use
If port 8080 is busy, edit `vite.config.ts`:
```typescript
server: {
  port: 8081, // or any other port
}
```

## Full Stack Startup

### Terminal 1: Backend
```bash
cd backend
python -m app.main
```
Backend: http://localhost:8000

### Terminal 2: Frontend  
```bash
cd C:\QAAI  # Root directory
npm run dev
```
Frontend: http://localhost:8080

## Verify Setup

1. Backend health: http://localhost:8000/health
2. Frontend: http://localhost:8080
3. Tunnel: http://localhost:31143/api/tags

All should respond!

