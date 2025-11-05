import re
import os

# Comprehensive emoji pattern
EMOJI_PATTERN = re.compile(r'[⚡📊💰🔥✅❌🎯📱🔒💎🌟🎁🏆⚙️🔍📈📉💵📋⏳🚫📅💬📧🔔⏰💸🎨💡🔐🛡️⭐✨🚨⚠️📢💭🗨️📝📄📃📑🗒️📰🗞️📓📔📕📗📘📙📚📖🔖📎🖇️📐📏📌📍✂️🖊️🖋️✒️🖌️🖍️🎤🎙️🎧📻📺📷📸📹🎥🎬🎭🎪🎨🎰🚀🛸🚁🚂🚃🚄🚅🚆🚇🚈🚉🚊🚝🚞🚋🚌🚍🚎🚐🚑🚒🚓🚔🚕🚖🚗🚘🚙🚚🚛🚜🏎️🏍️🛵🚲🛴🛹🛼⛸️🥌🎿⛷️🏂]')

# Emoji to Lucide icon mapping
EMOJI_MAP = {
    '⚡': ('Zap', 'w-4 h-4'),
    '✅': ('CheckCircle2', 'w-4 h-4'),
    '❌': ('XCircle', 'w-4 h-4'),
    '💰': ('DollarSign', 'w-4 h-4'),
    '🔥': ('Flame', 'w-4 h-4'),
    '📊': ('BarChart3', 'w-4 h-4'),
    '🎯': ('Target', 'w-4 h-4'),
    '⏳': ('Clock', 'w-4 h-4'),
    '🚫': ('Ban', 'w-4 h-4'),
    '📅': ('Calendar', 'w-4 h-4'),
    '🔒': ('Lock', 'w-4 h-4'),
    '⚙️': ('Settings', 'w-4 h-4'),
    '🔍': ('Search', 'w-4 h-4'),
    '💡': ('Lightbulb', 'w-4 h-4'),
    '📱': ('Smartphone', 'w-4 h-4'),
    '💬': ('MessageCircle', 'w-4 h-4'),
    '📧': ('Mail', 'w-4 h-4'),
    '⏰': ('AlarmClock', 'w-4 h-4'),
    '🎁': ('Gift', 'w-4 h-4'),
    '🏆': ('Trophy', 'w-4 h-4'),
    '🌟': ('Star', 'w-4 h-4'),
    '⭐': ('Star', 'w-4 h-4'),
    '💎': ('Gem', 'w-4 h-4'),
    '📈': ('TrendingUp', 'w-4 h-4'),
    '📉': ('TrendingDown', 'w-4 h-4'),
    '🔔': ('Bell', 'w-4 h-4'),
    '💵': ('Banknote', 'w-4 h-4'),
    '📋': ('ClipboardList', 'w-4 h-4'),
    '⚠️': ('AlertTriangle', 'w-4 h-4'),
    '✨': ('Sparkles', 'w-4 h-4'),
    '🚀': ('Rocket', 'w-4 h-4'),
    '🎨': ('Palette', 'w-4 h-4'),
    '📝': ('FileEdit', 'w-4 h-4'),
}

def should_skip_line(line):
    """Check if line should be skipped (comments, console logs)"""
    stripped = line.strip()
    return (stripped.startswith('//') or 
            'console.log' in line or 
            'console.error' in line or
            'console.warn' in line or
            'console.info' in line)

def replace_emojis_in_file(filepath):
    """Replace all UI emojis in a file with Lucide icons"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        modified = False
        new_lines = []
        used_icons = set()
        
        for line in lines:
            if should_skip_line(line):
                new_lines.append(line)
                continue
            
            new_line = line
            
            # Find all emojis in this line
            for match in EMOJI_PATTERN.finditer(line):
                emoji = match.group()
                if emoji in EMOJI_MAP:
                    icon_name, icon_class = EMOJI_MAP[emoji]
                    used_icons.add(icon_name)
                    
                    # Different replacement patterns based on context
                    # Pattern 1: Standalone in JSX: >emoji<
                    if f'>{emoji}<' in new_line:
                        new_line = new_line.replace(
                            f'>{emoji}<',
                            f'><{icon_name} className="{icon_class}" /></'
                        )
                        modified = True
                    
                    # Pattern 2: Start of text: >emoji text
                    elif f'>{emoji} ' in new_line:
                        new_line = new_line.replace(
                            f'>{emoji} ',
                            f'><{icon_name} className="{icon_class}" /> '
                        )
                        modified = True
                    
                    # Pattern 3: End of text: text emoji<
                    elif f' {emoji}<' in new_line:
                        new_line = new_line.replace(
                            f' {emoji}<',
                            f' <{icon_name} className="{icon_class}" /></'
                        )
                        modified = True
                    
                    # Pattern 4: In string: "emoji" or 'emoji'
                    elif f'"{emoji}"' in new_line or f"'{emoji}'" in new_line:
                        # Keep emojis in strings (might be for display purposes)
                        pass
            
            new_lines.append(new_line)
        
        if modified:
            # Write back
            with open(filepath, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
            
            return True, used_icons
        
        return False, set()
    
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False, set()

# Process all files
os.chdir('/Users/rickschlimback/Desktop/BlazeWallet 21-10/components')

completed_files = [
    'ScheduledTransactionsPanel.tsx',
    'UpcomingTransactionsBanner.tsx', 
    'SmartScheduleModal.tsx',
    'Dashboard.tsx',
    'AIPortfolioAdvisor.tsx',
    'AITransactionAssistant.tsx',
    'TransactionHistory.tsx',
    'SendModal.tsx',
    'ReceiveModal.tsx',
    'SwapModal.tsx'
]

files_modified = []
all_used_icons = set()

for filename in os.listdir('.'):
    if not filename.endswith('.tsx') or filename in completed_files:
        continue
    
    modified, used_icons = replace_emojis_in_file(filename)
    
    if modified:
        files_modified.append(filename)
        all_used_icons.update(used_icons)

print(f"✅ Modified {len(files_modified)} files")
print(f"📦 Icons used: {', '.join(sorted(all_used_icons))}")
print(f"\nModified files:")
for f in sorted(files_modified):
    print(f"  - {f}")
