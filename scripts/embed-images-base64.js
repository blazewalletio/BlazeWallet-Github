#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const files = [
  'public/email/blaze-icon-white.png',
  'public/email/icons/layers.png',
  'public/email/icons/shield.png',
  'public/email/icons/brain.png',
  'public/email/icons/zap.png',
  'public/email/icons/check.png',
];

const base64Data = {};

files.forEach(file => {
  const data = fs.readFileSync(file);
  const base64 = data.toString('base64');
  const key = path.basename(file, '.png');
  base64Data[key] = `data:image/png;base64,${base64}`;
  console.log(`${key}: ${base64.length} bytes (base64: ${base64Data[key].length} chars)`);
});

console.log('\n\nExport for use in template:\n');
console.log(JSON.stringify(base64Data, null, 2));
