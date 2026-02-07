#!/usr/bin/env python3
"""
Generate 20 trial license keys offline (2-week expiry). Same format as backend;
keys work with desktop offline validation and with backend when server is up.
No server required. Secret must match backend LICENSE_SECRET (default: flowstral-offline-2024).
"""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta

LICENSE_SECRET = "flowstral-offline-2024"
COUNT = 20
DAYS = 14

def generate_license_key(license_type: str, expiry_date: datetime) -> str:
    type_codes = {"trial": "T", "professional": "P", "enterprise": "E", "unlimited": "U"}
    type_code = type_codes.get(license_type, "T")
    expiry_yymm = expiry_date.strftime("%y%m")
    seg1 = type_code + secrets.token_hex(2).upper()
    seg2 = secrets.token_hex(2).upper() + "A"
    seg3 = expiry_yymm + secrets.token_hex(1).upper()[0]
    data_to_sign = f"FLOWSTRAL-{seg1}-{seg2}-{seg3}"
    checksum = hmac.new(
        LICENSE_SECRET.encode(), data_to_sign.encode(), hashlib.sha256
    ).hexdigest()[:5].upper()
    return f"{data_to_sign}-{checksum}"

def main():
    expiry = datetime.now() + timedelta(days=DAYS)
    print(f"# 20 trial licenses — valid {DAYS} days, expires {expiry.date()}\n")
    for i in range(1, COUNT + 1):
        key = generate_license_key("trial", expiry)
        print(key)
    print("\n# Distribute one key per tester. They enter it in Desktop Settings -> License.")

if __name__ == "__main__":
    main()
