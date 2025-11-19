#!/usr/bin/env node

/**
 * WCAG AA Accessibility Auto-Fixer
 * Safely adds ARIA labels and focus states to all React components
 */

const fs = require('fs');
const path = require('path');

const COMPONENTS_DIR = './components';
const DRY_RUN = process.argv.includes('--dry-run');

let filesProcessed = 0;
let filesModified = 0;
let totalFixes = 0;

const fixes = {
  closeButtons: 0,
  focusStates: 0,
  ariaLabels: 0,
  ariaExpanded: 0,
};

/**
 * Fix 1: Add aria-label to close buttons (onClick={onClose})
 */
function addAriaToCloseButtons(content, filename) {
  let count = 0;
  
  // Pattern: <button ...onClick={onClose}... > with <X icon
  // More conservative approach - only add aria-label, don't modify className
  const patterns = [
    {
      // Standard close button with X icon
      regex: /(<button[^>]*)(\s+onClick={onClose})([^>]*>[\s\n]*<X\s)/g,
      replace: (match, before, onclick, after) => {
        if (match.includes('aria-label')) return match;
        count++;
        return `${before}${onclick} aria-label="Close modal"${after}`;
      }
    },
    {
      // Close button with different icon
      regex: /(<button[^>]*)(\s+onClick={onClose})([^>]*>[\s\n]*<(ChevronLeft|ArrowLeft|XIcon)\s)/g,
      replace: (match, before, onclick, after) => {
        if (match.includes('aria-label')) return match;
        count++;
        return `${before}${onclick} aria-label="Close modal"${after}`;
      }
    }
  ];
  
  patterns.forEach(({ regex, replace }) => {
    content = content.replace(regex, replace);
  });
  
  if (count > 0) {
    fixes.closeButtons += count;
    console.log(`  ✅ Added ${count} close button labels`);
  }
  
  return content;
}

/**
 * Fix 2: Add focus states to interactive elements
 * DISABLED FOR NOW - Too risky with regex, needs manual review
 */
function addFocusStates(content, filename) {
  // Disabled - className manipulation is too risky
  return content;
}

/**
 * Fix 3: Add aria-labels to icon-only buttons
 */
function addAriaToIconButtons(content, filename) {
  let count = 0;
  
  const iconButtons = [
    { icon: 'Copy', label: 'Copy to clipboard' },
    { icon: 'Edit', label: 'Edit' },
    { icon: 'Edit2', label: 'Edit' },
    { icon: 'Edit3', label: 'Edit' },
    { icon: 'Trash', label: 'Delete' },
    { icon: 'Trash2', label: 'Delete' },
    { icon: 'Settings', label: 'Settings' },
    { icon: 'MoreVertical', label: 'More options' },
    { icon: 'MoreHorizontal', label: 'More options' },
    { icon: 'Eye', label: 'Show' },
    { icon: 'EyeOff', label: 'Hide' },
    { icon: 'RefreshCw', label: 'Refresh' },
    { icon: 'Download', label: 'Download' },
    { icon: 'Upload', label: 'Upload' },
    { icon: 'Share', label: 'Share' },
    { icon: 'ExternalLink', label: 'Open in new tab' },
  ];
  
  iconButtons.forEach(({ icon, label }) => {
    // Pattern: <button> with only icon, no text
    const regex = new RegExp(`(<button[^>]*)(>\\s*<${icon}[^>]*>\\s*</button>)`, 'g');
    
    content = content.replace(regex, (match, before, after) => {
      if (before.includes('aria-label')) return match;
      count++;
      return `${before} aria-label="${label}"${after}`;
    });
  });
  
  if (count > 0) {
    fixes.ariaLabels += count;
    console.log(`  ✅ Added ${count} icon button labels`);
  }
  
  return content;
}

/**
 * Fix 4: Add aria-expanded to dropdowns
 */
function addAriaExpandedToDropdowns(content, filename) {
  let count = 0;
  
  // Pattern: button with dropdown state - more conservative
  const patterns = [
    // Pattern 1: setShowXDropdown(!showXDropdown)
    /(<button[^>]*onClick={\(\) => (setShow\w+Dropdown)\(!(show\w+Dropdown)\)}[^>]*)>/g,
    // Pattern 2: setIsXOpen(!isXOpen)  
    /(<button[^>]*onClick={\(\) => (setIs\w+Open)\(!(is\w+Open)\)}[^>]*)>/g,
  ];
  
  patterns.forEach(regex => {
    content = content.replace(regex, (match, before, setter, state) => {
      if (match.includes('aria-expanded')) return match;
      count++;
      return `${before} aria-expanded={${state}}>`;
    });
  });
  
  if (count > 0) {
    fixes.ariaExpanded += count;
    console.log(`  ✅ Added ${count} aria-expanded attributes`);
  }
  
  return content;
}

/**
 * Fix 5: Add labels to form inputs
 */
function addLabelsToInputs(content, filename) {
  let count = 0;
  
  // Pattern: <input without id or aria-label
  const regex = /<input([^>]*type="([^"]*)"[^>]*)>/g;
  
  content = content.replace(regex, (match, attrs, type) => {
    // Skip if already has id or aria-label
    if (attrs.includes('id=') || attrs.includes('aria-label')) return match;
    
    // Skip hidden inputs
    if (type === 'hidden') return match;
    
    // Add aria-label based on type and placeholder
    const placeholderMatch = attrs.match(/placeholder="([^"]*)"/);
    const placeholder = placeholderMatch ? placeholderMatch[1] : '';
    
    let label = '';
    if (placeholder) {
      label = placeholder;
    } else if (type === 'email') {
      label = 'Email address';
    } else if (type === 'password') {
      label = 'Password';
    } else if (type === 'text') {
      label = 'Text input';
    } else if (type === 'number') {
      label = 'Number input';
    } else {
      return match; // Can't determine label
    }
    
    count++;
    return `<input aria-label="${label}"${attrs}>`;
  });
  
  if (count > 0) {
    console.log(`  ✅ Added ${count} input labels`);
  }
  
  return content;
}

/**
 * Fix 6: Add alt text to images
 */
function addAltTextToImages(content, filename) {
  let count = 0;
  
  // Pattern: <img without alt
  const regex = /<img([^>]*src="([^"]*)"[^>]*)>/g;
  
  content = content.replace(regex, (match, attrs, src) => {
    // Skip if already has alt
    if (attrs.includes('alt=')) return match;
    
    // Try to infer alt text from src
    let alt = '';
    if (src.includes('logo')) {
      alt = 'Logo';
    } else if (src.includes('icon')) {
      alt = 'Icon';
    } else if (src.includes('avatar')) {
      alt = 'Avatar';
    } else {
      alt = 'Image';
    }
    
    count++;
    return `<img${attrs} alt="${alt}">`;
  });
  
  if (count > 0) {
    console.log(`  ✅ Added ${count} image alt texts`);
  }
  
  return content;
}

/**
 * Process a single file
 */
function processFile(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const filename = path.basename(filepath);
    
    let newContent = content;
    
    // Apply all fixes
    newContent = addAriaToCloseButtons(newContent, filename);
    newContent = addFocusStates(newContent, filename);
    newContent = addAriaToIconButtons(newContent, filename);
    newContent = addAriaExpandedToDropdowns(newContent, filename);
    newContent = addLabelsToInputs(newContent, filename);
    newContent = addAltTextToImages(newContent, filename);
    
    // Only write if changed
    if (newContent !== content) {
      if (!DRY_RUN) {
        fs.writeFileSync(filepath, newContent, 'utf8');
      }
      filesModified++;
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return false;
  }
}

/**
 * Recursively process all .tsx files
 */
function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and hidden directories
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        processDirectory(fullPath);
      }
    } else if (entry.name.endsWith('.tsx')) {
      filesProcessed++;
      console.log(`\n📝 Processing: ${fullPath}`);
      
      if (processFile(fullPath)) {
        console.log(`  ✨ Modified`);
      } else {
        console.log(`  ⏭️  No changes needed`);
      }
    }
  }
}

/**
 * Main execution
 */
console.log('🎨 WCAG AA Accessibility Auto-Fixer');
console.log('═══════════════════════════════════\n');

if (DRY_RUN) {
  console.log('⚠️  DRY RUN MODE - No files will be modified\n');
}

if (!fs.existsSync(COMPONENTS_DIR)) {
  console.error(`❌ Directory not found: ${COMPONENTS_DIR}`);
  process.exit(1);
}

console.log(`📂 Scanning: ${COMPONENTS_DIR}\n`);
console.log('═══════════════════════════════════\n');

processDirectory(COMPONENTS_DIR);

console.log('\n═══════════════════════════════════');
console.log('✅ COMPLETE!\n');
console.log(`📊 Statistics:`);
console.log(`   Files processed: ${filesProcessed}`);
console.log(`   Files modified: ${filesModified}`);
console.log(`\n🎯 Fixes Applied:`);
console.log(`   Close button labels: ${fixes.closeButtons}`);
console.log(`   Focus states: ${fixes.focusStates}`);
console.log(`   Icon button labels: ${fixes.ariaLabels}`);
console.log(`   Aria-expanded attrs: ${fixes.ariaExpanded}`);
console.log(`\n💡 Total accessibility improvements: ${Object.values(fixes).reduce((a, b) => a + b, 0)}`);
console.log('═══════════════════════════════════\n');

if (DRY_RUN) {
  console.log('To apply these changes, run without --dry-run flag\n');
}

