/**
 * Chat Integration Script
 * Applies enhanced chat features to all chat pages
 */

// Add the enhanced-chat-features.js to all chat-related HTML files
const fs = require('fs');
const path = require('path');

const chatPages = [
  'public/dashboard.html',
  'public/account.html', 
  'public/chat-user-management.html',
  'public/direct-messages.html',
  'admin_views/admin-chat.html',
  'admin_views/admin.html'
];

const scriptTags = [
  '<script src="/chat/enhanced-chat-features.js"></script>',
  '<script src="/chat/enhanced-socket-handlers.js"></script>'
];

function integrateEnhancedFeatures() {
  chatPages.forEach(pageFile => {
    const filePath = path.join(__dirname, pageFile);
    
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Check if already integrated
      if (!content.includes('enhanced-chat-features.js')) {
        // Find the closing body tag and insert before it
        if (content.includes('</body>')) {
          const scriptsToAdd = scriptTags.join('\n  ');
          content = content.replace('</body>', `  ${scriptsToAdd}\n</body>`);
          fs.writeFileSync(filePath, content);
          console.log(`✅ Enhanced features added to ${pageFile}`);
        } else {
          console.log(`⚠️  No closing body tag found in ${pageFile}`);
        }
      } else {
        console.log(`✅ Enhanced features already present in ${pageFile}`);
      }
    } else {
      console.log(`❌ File not found: ${pageFile}`);
    }
  });
  
  console.log('\n🎉 Chat enhancement integration complete!');
}

// Run the integration
integrateEnhancedFeatures();
