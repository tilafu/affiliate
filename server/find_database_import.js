// File scanner to find '../config/database' import
const fs = require('fs');
const path = require('path');
const util = require('util');

const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);
const readFile = util.promisify(fs.readFile);

async function findInFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    if (content.includes("../config/database")) {
      console.log(`Found in file: ${filePath}`);
      
      // Find the line number
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("../config/database")) {
          console.log(`Line ${i+1}: ${lines[i].trim()}`);
        }
      }
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err.message);
    return false;
  }
}

async function scanDirectory(directory) {
  try {
    const files = await readdir(directory);
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      const fileStat = await stat(filePath);
      
      if (fileStat.isDirectory()) {
        // Skip node_modules to avoid too much recursion
        if (file !== 'node_modules') {
          await scanDirectory(filePath);
        }
      } else if (file.endsWith('.js')) {
        await findInFile(filePath);
      }
    }
  } catch (err) {
    console.error(`Error scanning directory ${directory}:`, err.message);
  }
}

// Start scan from the server directory
const serverDir = __dirname;
console.log(`Starting scan in ${serverDir}`);
scanDirectory(serverDir).then(() => {
  console.log('Scan complete');
});
