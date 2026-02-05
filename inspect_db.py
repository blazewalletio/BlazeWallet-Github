#!/usr/bin/env python3
import requests
import json

SUPABASE_URL = "https://ldehmephukevxumwdbwt.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZWhtZXBodWtldnh1bXdkYnd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIwMDg2MSwiZXhwIjoyMDc2Nzc2ODYxfQ.nhpYh_LREwR-qO12LCzfO9K3zHz_49aO_fle4j_gw7c"

print("🔍 Inspecting Supabase Database\n")
print("=" * 60)

# 1. Find all tables with 'expires_at' column
print("\n1️⃣ Finding tables with 'expires_at' column...")
print("-" * 60)

url = f"{SUPABASE_URL}/rest/v1/columns"
headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
}

# Try to query information_schema via select
url_query = f"{SUPABASE_URL}/rest/v1/information_schema.columns?column_name=eq.expires_at&table_schema=eq.public&select=table_name,column_name,data_type"
response = requests.get(url_query, headers=headers)

if response.status_code == 200:
    tables = response.json()
    print(f"✅ Found {len(tables)} tables with 'expires_at':")
    for table in tables:
        print(f"   - {table['table_name']}.{table['column_name']} ({table['data_type']})")
else:
    print(f"❌ Error: {response.status_code}")
    print(f"Response: {response.text}")

# 2. Get user_2fa_sessions table schema
print("\n2️⃣ Getting user_2fa_sessions table schema...")
print("-" * 60)

# Check if we can query the table
url_sessions = f"{SUPABASE_URL}/rest/v1/user_2fa_sessions?select=*&limit=1"
response = requests.get(url_sessions, headers=headers)

if response.status_code == 200:
    print("✅ user_2fa_sessions table exists and is accessible")
    if response.json():
        print(f"   Sample record keys: {list(response.json()[0].keys())}")
else:
    print(f"❌ Error accessing table: {response.status_code}")
    print(f"Response: {response.text}")

# 3. Try to reproduce the error
print("\n3️⃣ Reproducing the check_2fa_session error...")
print("-" * 60)

url_check = f"{SUPABASE_URL}/rest/v1/rpc/check_2fa_session"
test_payload = {
    "p_user_id": "00000000-0000-0000-0000-000000000000",
    "p_session_token": None
}
response = requests.post(url_check, headers=headers, json=test_payload)

print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

if "ambiguous" in response.text:
    print("\n✅ ERROR CONFIRMED: 'expires_at' is ambiguous!")
    print("   This means multiple tables/contexts have this column")

print("\n" + "=" * 60)
print("✅ Inspection complete!")

