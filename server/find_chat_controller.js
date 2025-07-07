// Quick script to check if we have multiple chatController.js files
const fs = require('fs');
const path = require('path');

// Get the directory structure
function scanDirectory(dir, depth = 0, maxDepth = 10) {
  if (depth > maxDepth) return;
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      if (item === 'node_modules') continue;
      
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        scanDirectory(fullPath, depth + 1, maxDepth);
      } else if (item.toLowerCase().includes('chatcontroller.js')) {
        console.log(`Found: ${fullPath}`);
        
        // Read file content
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          const firstLine = lines[0].trim();
          console.log(`First line: "${firstLine}"`);
          
          if (firstLine.includes('../config/database')) {
            console.log('⚠️ FOUND PROBLEMATIC IMPORT! ⚠️');
          }
        } catch (err) {
          console.error(`Error reading file: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning directory ${dir}: ${err.message}`);
  }
}

// Start scanning from the current directory
const rootDir = path.resolve(process.cwd(), '..');
console.log(`Scanning from: ${rootDir}`);
scanDirectory(rootDir);
