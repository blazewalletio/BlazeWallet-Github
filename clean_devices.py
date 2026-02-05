#!/usr/bin/env python3
"""
🧹 CLEAN START: Delete all trusted devices from Supabase

This script removes ALL trusted devices from the database so all users
can start fresh with the new "Trust Anchor" device verification system.

Usage:
    python3 clean_devices.py
"""

import requests

SUPABASE_URL = "https://ldehmephukevxumwdbwt.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZWhtZXBodWtldnh1bXdkYnd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIwMDg2MSwiZXhwIjoyMDc2Nzc2ODYxfQ.nhpYh_LREwR-qO12LCzfO9K3zHz_49aO_fle4j_gw7c"

print("=" * 70)
print("🧹 CLEAN START: Delete ALL Trusted Devices")
print("=" * 70)

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

# Step 1: Count existing devices
print("\n📊 Step 1: Counting existing devices...")
url_count = f"{SUPABASE_URL}/rest/v1/trusted_devices?select=id,user_id"
response = requests.get(url_count, headers=headers)

if response.status_code == 200:
    devices = response.json()
    total_devices = len(devices)
    unique_users = len(set(d['user_id'] for d in devices))
    
    print(f"✅ Found {total_devices} devices from {unique_users} users")
    
    if total_devices == 0:
        print("✅ No devices to delete. Database is already clean!")
        exit(0)
    
    # Confirm deletion
    print(f"\n⚠️  WARNING: About to delete {total_devices} devices!")
    confirm = input("Type 'DELETE' to confirm: ")
    
    if confirm != "DELETE":
        print("❌ Aborted. No devices were deleted.")
        exit(1)
else:
    print(f"❌ Error counting devices: {response.status_code}")
    print(f"Response: {response.text}")
    exit(1)

# Step 2: Delete all devices
print(f"\n🗑️  Step 2: Deleting {total_devices} devices...")
url_delete = f"{SUPABASE_URL}/rest/v1/trusted_devices?id=not.is.null"
response = requests.delete(url_delete, headers=headers)

if response.status_code in [200, 204]:
    print(f"✅ Successfully deleted all devices!")
else:
    print(f"❌ Error deleting devices: {response.status_code}")
    print(f"Response: {response.text}")
    exit(1)

# Step 3: Verify deletion
print("\n✅ Step 3: Verifying deletion...")
response = requests.get(url_count, headers=headers)

if response.status_code == 200:
    remaining = len(response.json())
    if remaining == 0:
        print("✅ Verification successful: 0 devices remaining")
    else:
        print(f"⚠️  Warning: {remaining} devices still exist")
else:
    print(f"❌ Error verifying: {response.status_code}")

print("\n" + "=" * 70)
print("✅ CLEAN START COMPLETE!")
print("=" * 70)
print("\nUsers will verify their devices again on next login.")
print("The new 'Trust Anchor' system will handle device matching smartly.")

