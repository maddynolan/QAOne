#!/usr/bin/env python3
"""
Generate 20 trial licenses (2-week expiry) for testers.
Run after backend is up: python scripts/generate_trial_licenses.py [BASE_URL]
Example: python scripts/generate_trial_licenses.py https://api.yourdomain.com
"""

import sys
import urllib.request
import json

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
URL = f"{BASE.rstrip('/')}/api/license/generate-trials?count=20&days=14"

def main():
    try:
        req = urllib.request.Request(URL)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        print(f"Error calling backend: {e}")
        print(f"Usage: python {__file__} [BASE_URL]")
        sys.exit(1)
    licenses = data.get("licenses", [])
    print(f"Generated {len(licenses)} trial licenses (valid {data.get('validDays', 14)} days, expires {data.get('expiresAt', '')})\n")
    for i, lic in enumerate(licenses, 1):
        print(f"{i:2}. {lic['key']}")
    print("\nDistribute these keys to testers. They enter the key in Desktop Settings → License.")

if __name__ == "__main__":
    main()
