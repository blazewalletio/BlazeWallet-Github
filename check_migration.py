#!/usr/bin/env python3
import requests

SUPABASE_URL = "https://ldehmephukevxumwdbwt.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZWhtZXBodWtldnh1bXdkYnd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIwMDg2MSwiZXhwIjoyMDc2Nzc2ODYxfQ.nhpYh_LREwR-qO12LCzfO9K3zHz_49aO_fle4j_gw7c"

print("🔍 Checking if migration 20260205000000 is applied...\n")

# Check schema_migrations table
url = f"{SUPABASE_URL}/rest/v1/schema_migrations?version=eq.20260205000000&select=*"
headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
}

response = requests.get(url, headers=headers)

if response.status_code == 200:
    migrations = response.json()
    if migrations:
        print("✅ Migration 20260205000000 IS applied!")
        print(f"   Details: {migrations}")
    else:
        print("❌ Migration 20260205000000 is NOT applied yet!")
        print("   You need to apply it to Supabase")
else:
    print(f"❌ Could not check migrations: {response.status_code}")
    print(f"   Response: {response.text}")
    
print("\n" + "="*60)
print("Summary:")
print("  - Original function at line 134: SELECT * INTO v_session")
print("  - Line 139: AND expires_at > NOW()  <-- AMBIGUOUS!")
print("  - Fix: Qualify with table: user_2fa_sessions.expires_at")
print("="*60)

