"""
Test Account Manager
Manages test accounts for QA exploration - reuses accounts intelligently.
"""

import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class TestAccount:
    """Represents a test account."""
    email: str
    password: str
    username: Optional[str] = None
    status: str = 'available'  # available, in_use, locked, expired
    last_used: Optional[datetime] = None
    use_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


class TestAccountManager:
    """Manages test accounts for exploration."""
    
    # Default test accounts (should be configured per environment)
    DEFAULT_TEST_ACCOUNTS = [
        {
            'email': 'qa_test_1@testdomain.com',
            'password': 'TestPassword123!',
            'username': 'qatest1'
        },
        {
            'email': 'qa_test_2@testdomain.com',
            'password': 'TestPassword123!',
            'username': 'qatest2'
        },
        {
            'email': 'qa_test_3@testdomain.com',
            'password': 'TestPassword123!',
            'username': 'qatest3'
        }
    ]
    
    def __init__(self, test_accounts: Optional[List[Dict]] = None):
        """Initialize with test accounts."""
        accounts_data = test_accounts or self.DEFAULT_TEST_ACCOUNTS
        self.accounts: List[TestAccount] = [
            TestAccount(**acc) for acc in accounts_data
        ]
        self.max_uses_per_account = 100  # Prevent overuse
        self.account_lock_duration_hours = 24  # Lock account for 24h after max uses
    
    def get_available_account(self) -> Optional[TestAccount]:
        """Get an available test account."""
        now = datetime.utcnow()
        
        for account in self.accounts:
            # Check if account is locked and lock has expired
            if account.status == 'locked':
                if account.last_used:
                    hours_since_use = (now - account.last_used).total_seconds() / 3600
                    if hours_since_use >= self.account_lock_duration_hours:
                        account.status = 'available'
                        account.use_count = 0
                        logger.info(f"Account {account.email} lock expired, making available")
            
            # Check if account is available and not overused
            if account.status == 'available':
                if account.use_count < self.max_uses_per_account:
                    account.status = 'in_use'
                    account.last_used = now
                    account.use_count += 1
                    logger.info(f"Allocated account {account.email} (use #{account.use_count})")
                    return account
                else:
                    # Lock account if overused
                    account.status = 'locked'
                    logger.warning(f"Account {account.email} overused, locking for {self.account_lock_duration_hours}h")
        
        logger.warning("No available test accounts")
        return None
    
    def release_account(self, email: str, success: bool = True):
        """Release account back to pool."""
        for account in self.accounts:
            if account.email == email:
                if account.status == 'in_use':
                    account.status = 'available'
                    logger.info(f"Released account {account.email} (success: {success})")
                else:
                    logger.warning(f"Account {account.email} was not in use")
                return
        
        logger.warning(f"Account {email} not found")
    
    def get_account_by_email(self, email: str) -> Optional[TestAccount]:
        """Get account by email."""
        for account in self.accounts:
            if account.email == email:
                return account
        return None
    
    def add_account(self, email: str, password: str, username: Optional[str] = None):
        """Add a new test account."""
        account = TestAccount(email=email, password=password, username=username)
        self.accounts.append(account)
        logger.info(f"Added test account {email}")
    
    def get_account_status(self) -> Dict[str, Any]:
        """Get status of all accounts."""
        return {
            'total': len(self.accounts),
            'available': len([a for a in self.accounts if a.status == 'available']),
            'in_use': len([a for a in self.accounts if a.status == 'in_use']),
            'locked': len([a for a in self.accounts if a.status == 'locked']),
            'accounts': [
                {
                    'email': acc.email,
                    'status': acc.status,
                    'use_count': acc.use_count,
                    'last_used': acc.last_used.isoformat() if acc.last_used else None
                }
                for acc in self.accounts
            ]
        }







