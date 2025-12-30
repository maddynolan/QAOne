# Salesforce Authentication - What We Learned (ELI5)

## 🎯 The Goal
We wanted Flowstral to connect to your Salesforce org to fetch metadata (objects, fields, picklists) for smart test validation.

---

## 🚧 The Issues We Hit (And Why)

### Issue 1: SOAP API Disabled
```
❌ SOAP API login() is disabled by default in this org
```

**What is SOAP API?**
- Think of it as the "old way" of talking to Salesforce
- Like sending a formal letter vs a text message
- Uses username + password + security token directly

**Why was it blocked?**
- Your org was created after Summer '23
- Salesforce disabled SOAP by default for security
- It's like Salesforce said: "No more simple password logins for API"

---

### Issue 2: OAuth Username-Password Flow Failed
```
❌ invalid_grant: authentication failure
```

**What is OAuth Username-Password Flow?**
- A "newer" way to log in programmatically
- Still uses your username/password, but through a Connected App
- Like using your Google account to log into other websites

**Why did it fail?**
- Even though we enabled all settings, newer Salesforce orgs are STRICT
- The "orgfarm" prefix means it's a special provisioned org
- These orgs often have extra security restrictions we can't see

**Settings we enabled (but still didn't work):**
1. ✅ API Enabled on Profile
2. ✅ OAuth Username-Password Flows enabled
3. ✅ Created Connected App (Flowdev)
4. ✅ Relaxed IP restrictions
5. ✅ Reset Security Token

---

### Issue 3: PKCE Required
```
❌ missing required code challenge
```

**What is PKCE?** (Proof Key for Code Exchange)
- An extra security layer for OAuth
- Like a secret handshake before the real handshake
- Prevents attackers from intercepting your login

**Why was it required?**
- Your Connected App was set to require PKCE by default
- Modern security best practice
- Once we added PKCE, it worked!

---

## ✅ What Finally Worked: OAuth Web Flow with PKCE

```
[Your Browser] → [Salesforce Login] → [Grant Permission] → [Get Code] → [Exchange for Token]
```

**Step by Step:**
1. **Browser opens** Salesforce login page
2. **You log in** with your credentials (MFA if needed)
3. **You approve** the Flowdev app
4. **Salesforce gives us** an authorization code
5. **We exchange** that code (with PKCE secret) for tokens
6. **SUCCESS!** We get access_token + refresh_token

---

## 📊 Authentication Methods Comparison

| Method | Security | Ease of Setup | Works on New Orgs? |
|--------|----------|---------------|-------------------|
| **SOAP API** | Low 🔓 | Easy | ❌ No (disabled) |
| **OAuth Password** | Medium 🔒 | Medium | ❌ Often blocked |
| **OAuth Web + PKCE** | High 🔐 | Complex | ✅ Yes (recommended) |
| **JWT Bearer** | Highest 🔐🔐 | Complex | ✅ Yes |

---

## 🔧 For Future Salesforce Connections

### Minimum Setup Needed:

1. **Create External Client App**
   - Setup → App Manager → New External Client App
   - Enable OAuth
   - Add scopes: `full`, `refresh_token`

2. **Configure OAuth Policies**
   - Permitted Users: "All users may self-authorize"
   - IP Relaxation: "Relax IP restrictions"

3. **Enable OAuth Flows** (Setup → OAuth Settings)
   - ✅ Allow OAuth Username-Password Flows (optional)
   - ✅ Allow OAuth User-Agent Flows

4. **User Profile**
   - ✅ API Enabled checkbox must be checked

5. **Use Web-Based OAuth with PKCE**
   - Most reliable method
   - Works with MFA
   - Browser-based authorization

---

## 🔑 Tokens Explained

### Access Token
- **What:** Your "key" to access Salesforce API
- **Duration:** ~2 hours
- **Like:** A visitor badge that expires

### Refresh Token
- **What:** Used to get a new access token without re-logging in
- **Duration:** Long-lived (until revoked)
- **Like:** A membership card to get new visitor badges

### How to refresh (when access token expires):
```python
response = requests.post('https://login.salesforce.com/services/oauth2/token', data={
    'grant_type': 'refresh_token',
    'client_id': 'YOUR_CLIENT_ID',
    'client_secret': 'YOUR_CLIENT_SECRET',
    'refresh_token': 'YOUR_REFRESH_TOKEN'
})
new_access_token = response.json()['access_token']
```

---

## 📁 Files Saved

| File | Purpose |
|------|---------|
| `backend/config/salesforce_credentials.json` | Your OAuth tokens |
| `docs/SALESFORCE_AUTH_EXPLAINED.md` | This document |

---

## 🎓 Key Takeaways

1. **Salesforce security is complex** - newer orgs have stricter defaults
2. **SOAP API is dead** - don't rely on it for new implementations
3. **OAuth Web Flow + PKCE is the way** - works everywhere, most secure
4. **Connected Apps need configuration** - IP relaxation, user permissions
5. **Keep your refresh token safe** - it's the key to continuous access

---

## 🆘 Troubleshooting Checklist

If OAuth fails again, check:

- [ ] Is the Connected App enabled?
- [ ] Are OAuth scopes correct? (full, refresh_token)
- [ ] Is IP Relaxation set?
- [ ] Is "API Enabled" checked on user profile?
- [ ] Are OAuth flows enabled in org settings?
- [ ] Is the user an API-only user? (should NOT be)
- [ ] Did you wait 2-10 minutes after creating the app?

---

*Document created: December 17, 2024*
*Org: orgfarm-bac28d1362-dev-ed.develop.my.salesforce.com*



