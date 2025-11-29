"""
Pytest configuration and fixtures
This file is shared across all API tests
"""

import pytest
import os

@pytest.fixture
def base_url():
    """Base URL for API tests"""
    return os.getenv("BASE_URL", "http://localhost:8000")

@pytest.fixture
def api_headers():
    """Default API headers"""
    return {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }




