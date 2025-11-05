#!/usr/bin/env python3
"""
Final emoji cleanup for Blaze Wallet
Replaces ONLY UI emojis, preserves code comments and console logs
"""
import re, os, sys

os.chdir('components')

# Emoji to Lucide icon mapping  
REPLACEMENTS = [
    # Pattern: JSX text content with emoji
    (r'>⚡<', r'><Zap className="w-4 h-4" /></'),
    (r'>⚡ ', r'><Zap className="w-4 h-4" /> '),
    (r'>✅<', r'><CheckCircle2 className="w-4 h-4" /></'),
    (r'>✅ ', r'><CheckCircle2 className="w-4 h-4" /> '),
    (r'>❌ ', r'><XCircle className="w-4 h-4" /> '),
    (r'>💰<', r'><DollarSign className="w-4 h-4" /></'),
    (r'>💰 ', r'><DollarSign className="w-4 h-4" /> '),
    (r'>🔥 ', r'><Flame className="w-4 h-4" /> '),
    (r'>📊 ', r'><BarChart3 className="w-4 h-4" /> '),
    (r'>🎯 ', r'><Target className="w-4 h-4" /> '),
    (r'>⏳ ', r'><Clock className="w-4 h-4" /> '),
    (r'>🚫 ', r'><Ban className="w-4 h-4" /> '),
    (r'>📅 ', r'><Calendar className="w-4 h-4" /> '),
    (r'>🔒 ', r'><Lock className="w-4 h-4" /> '),
    (r'>⚙️ ', r'><Settings className="w-4 h-4" /> '),
    (r'>🔍 ', r'><Search className="w-4 h-4" /> '),
    (r'>💡 ', r'><Lightbulb className="w-4 h-4" /> '),
    (r'>📱 ', r'><Smartphone className="w-4 h-4" /> '),
    (r'>💬 ', r'><MessageCircle className="w-4 h-4" /> '),
    (r'>🎁 ', r'><Gift className="w-4 h-4" /> '),
    (r'>🏆 ', r'><Trophy className="w-4 h-4" /> '),
    (r'>🌟 ', r'><Star className="w-4 h-4" /> '),
    (r'>⭐ ', r'><Star className="w-4 h-4" /> '),
]

# Get all TSX files except already completed
COMPLETED = [
    'ScheduledTransactionsPanel.tsx',
    'UpcomingTransactionsBanner.tsx',
    'SmartScheduleModal.tsx',
    'Dashboard.tsx',
    'AIPortfolioAdvisor.tsx',
    'AITransactionAssistant.tsx',
    'TransactionHistory.tsx',
    'SendModal.tsx',
    'ReceiveModal.tsx',
    'SwapModal.tsx',
]

files_modified = []
total_replacements = 0

for filename in os.listdir('.'):
    if not filename.endswith('.tsx') or filename in COMPLETED:
        continue
    
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        file_replacements = 0
        
        # Apply all replacements
        for pattern, replacement in REPLACEMENTS:
            matches = len(re.findall(pattern, content))
            if matches > 0:
                content = re.sub(pattern, replacement, content)
                file_replacements += matches
        
        # Write if modified
        if content != original:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(content)
            files_modified.append((filename, file_replacements))
            total_replacements += file_replacements
    
    except Exception as e:
        print(f"⚠️  Error processing {filename}: {e}", file=sys.stderr)

print(f"✅ Modified {len(files_modified)} files")
print(f"🔄 Total replacements: {total_replacements}")

if files_modified:
    print(f"\nFiles modified:")
    for fname, count in sorted(files_modified, key=lambda x: x[1], reverse=True):
        print(f"  {count:2d} - {fname}")
