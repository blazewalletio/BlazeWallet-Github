#!/usr/bin/env python3
"""
Add ARIA labels to buttons with icons that are missing accessibility attributes.
This ensures WCAG 2.1 AA compliance for screen readers.
"""

import re
import os
import glob

COMPONENTS_DIR = "/Users/rickschlimback/Desktop/BlazeWallet 13-11/components"

# Patterns to match and their aria-labels
PATTERNS = [
    # Close buttons (X icon)
    {
        "pattern": r'(<button[^>]*)(>\s*<X className)',
        "replacement": r'\1 aria-label="Close"\2',
        "condition": lambda match: 'aria-label' not in match.group(1)
    },
    # Settings buttons
    {
        "pattern": r'(<button[^>]*)(>\s*<Settings className)',
        "replacement": r'\1 aria-label="Open settings"\2',
        "condition": lambda match: 'aria-label' not in match.group(1)
    },
    # User/Profile buttons
    {
        "pattern": r'(<button[^>]*)(>\s*<User className)',
        "replacement": r'\1 aria-label="Open profile"\2',
        "condition": lambda match: 'aria-label' not in match.group(1)
    },
    # Copy buttons
    {
        "pattern": r'(<button[^>]*)(>\s*<Copy className)',
        "replacement": r'\1 aria-label="Copy to clipboard"\2',
        "condition": lambda match: 'aria-label' not in match.group(1)
    },
    # Check/Checkmark buttons
    {
        "pattern": r'(<button[^>]*)(>\s*<Check className)',
        "replacement": r'\1 aria-label="Confirm"\2',
        "condition": lambda match: 'aria-label' not in match.group(1)
    },
    # Refresh buttons
    {
        "pattern": r'(<button[^>]*)(>\s*<RefreshCw className)',
        "replacement": r'\1 aria-label="Refresh"\2',
        "condition": lambda match: 'aria-label' not in match.group(1)
    },
    # Edit buttons
    {
        "pattern": r'(<button[^>]*)(>\s*<Edit[2]? className)',
        "replacement": r'\1 aria-label="Edit"\2',
        "condition": lambda match: 'aria-label' not in match.group(1)
    },
    # Trash/Delete buttons
    {
        "pattern": r'(<button[^>]*)(>\s*<Trash[2]? className)',
        "replacement": r'\1 aria-label="Delete"\2',
        "condition": lambda match: 'aria-label' not in match.group(1)
    },
    # Plus/Add buttons
    {
        "pattern": r'(<button[^>]*)(>\s*<Plus className)',
        "replacement": r'\1 aria-label="Add"\2',
        "condition": lambda match: 'aria-label' not in match.group(1)
    },
    # Menu buttons
    {
        "pattern": r'(<button[^>]*)(>\s*<Menu className)',
        "replacement": r'\1 aria-label="Open menu"\2',
        "condition": lambda match: 'aria-label' not in match.group(1)
    },
    # External link buttons
    {
        "pattern": r'(<button[^>]*)(>\s*<ExternalLink className)',
        "replacement": r'\1 aria-label="Open in new tab"\2',
        "condition": lambda match: 'aria-label' not in match.group(1)
    },
]

# Focus states to add to all buttons
FOCUS_STATE = "focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"

def add_aria_labels(file_path):
    """Add aria-labels to a single file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    changes = 0
    
    # Apply each pattern
    for pattern_info in PATTERNS:
        pattern = pattern_info["pattern"]
        replacement = pattern_info["replacement"]
        condition = pattern_info["condition"]
        
        # Find all matches
        for match in re.finditer(pattern, content):
            if condition(match):
                content = content.replace(match.group(0), re.sub(pattern, replacement, match.group(0)))
                changes += 1
    
    # Add focus states to buttons missing them
    # Match buttons that don't have focus: classes
    button_pattern = r'(<button[^>]*className="[^"]*?)(")'
    for match in re.finditer(button_pattern, content):
        button_tag = match.group(1)
        if 'focus:' not in button_tag and 'className=' in button_tag:
            # Add focus state before closing quote
            new_button = button_tag + " " + FOCUS_STATE
            content = content.replace(match.group(0), new_button + match.group(2))
            changes += 1
    
    # Only write if changes were made
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return changes
    
    return 0

def main():
    """Process all TypeScript files in components directory."""
    pattern = os.path.join(COMPONENTS_DIR, "*.tsx")
    files = glob.glob(pattern)
    
    total_changes = 0
    files_changed = 0
    
    for file_path in files:
        changes = add_aria_labels(file_path)
        if changes > 0:
            files_changed += 1
            total_changes += changes
            print(f"✅ {os.path.basename(file_path)}: {changes} improvements")
    
    print(f"\n🎉 COMPLETE: {total_changes} accessibility improvements across {files_changed} files!")

if __name__ == "__main__":
    main()

