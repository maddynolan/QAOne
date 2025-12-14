"""Test token creation and validation"""
from main import create_access_token, get_current_user, SECRET_KEY, ALGORITHM, SessionLocal
from jose import jwt

# Test token creation
token = create_access_token({"sub": 1})
print(f"Token created: {token[:50]}...")

# Test token decoding
payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
print(f"Decoded payload: {payload}")
print(f"User ID: {payload.get('sub')}, Type: {type(payload.get('sub'))}")

# Test get_current_user
db = SessionLocal()
try:
    # This should work
    user = get_current_user(token, db)
    print(f"✅ User found: {user.username}")
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    db.close()


