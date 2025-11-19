#!/usr/bin/env node

/**
 * WCAG AA - Phase 2: Focus States
 * Adds focus:ring-2 to ALL interactive elements
 */

const fs = require('fs');
const path = require('path');

const COMPONENTS_DIR = './components';
const DRY_RUN = process.argv.includes('--dry-run');

let filesProcessed = 0;
let filesModified = 0;
let focusStatesAdded = 0;

/**
 * Add focus states to buttons
 */
function addFocusToButtons(content, filename) {
  let count = 0;
  
  // Pattern 1: <button with className but no focus
  const buttonRegex = /<button([^>]*className="([^"]*)"[^>]*)>/g;
  
  content = content.replace(buttonRegex, (match, beforeClose, classes) => {
    // Skip if already has focus
    if (classes.includes('focus:')) return match;
    
    // Skip if not interactive (no hover or explicit styling)
    if (!classes.includes('hover:') && !classes.includes('bg-') && !classes.includes('border-')) {
      return match;
    }
    
    count++;
    const newClasses = classes + ' focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2';
    return match.replace(`className="${classes}"`, `className="${newClasses}"`);
  });
  
  if (count > 0) {
    focusStatesAdded += count;
    console.log(`  ✅ Added ${count} button focus states`);
  }
  
  return content;
}

/**
 * Add focus states to inputs
 */
function addFocusToInputs(content, filename) {
  let count = 0;
  
  // Pattern: <input with className but no focus
  const inputRegex = /<input([^>]*className="([^"]*)"[^>]*)>/g;
  
  content = content.replace(inputRegex, (match, beforeClose, classes) => {
    // Skip if already has focus
    if (classes.includes('focus:')) return match;
    
    count++;
    const newClasses = classes + ' focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent';
    return match.replace(`className="${classes}"`, `className="${newClasses}"`);
  });
  
  if (count > 0) {
    focusStatesAdded += count;
    console.log(`  ✅ Added ${count} input focus states`);
  }
  
  return content;
}

/**
 * Add focus states to textareas
 */
function addFocusToTextareas(content, filename) {
  let count = 0;
  
  const textareaRegex = /<textarea([^>]*className="([^"]*)"[^>]*)>/g;
  
  content = content.replace(textareaRegex, (match, beforeClose, classes) => {
    if (classes.includes('focus:')) return match;
    
    count++;
    const newClasses = classes + ' focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent';
    return match.replace(`className="${classes}"`, `className="${newClasses}"`);
  });
  
  if (count > 0) {
    focusStatesAdded += count;
    console.log(`  ✅ Added ${count} textarea focus states`);
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
    newContent = addFocusToButtons(newContent, filename);
    newContent = addFocusToInputs(newContent, filename);
    newContent = addFocusToTextareas(newContent, filename);
    
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
console.log('🎯 WCAG AA - Phase 2: Focus States');
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
console.log(`   Focus states added: ${focusStatesAdded}`);
console.log('═══════════════════════════════════\n');

if (DRY_RUN) {
  console.log('To apply these changes, run without --dry-run flag\n');
}

