"""Update test user passwords to complex, secure passwords"""
from main import SessionLocal, User, get_password_hash

db = SessionLocal()

try:
    # Update admin password
    admin = db.query(User).filter(User.username == 'admin').first()
    if admin:
        admin.hashed_password = get_password_hash('Admin@2024!Secure#Test')
        print('✅ Admin password updated')
    else:
        print('⚠️  Admin user not found')
    
    # Update test user password
    user = db.query(User).filter(User.username == 'testuser').first()
    if user:
        user.hashed_password = get_password_hash('TestUser@2024!Secure#Pass')
        print('✅ User password updated')
    else:
        print('⚠️  Test user not found')
    
    db.commit()
    print('✅ Database updated successfully')
    
except Exception as e:
    print(f'❌ Error: {e}')
    db.rollback()
finally:
    db.close()


