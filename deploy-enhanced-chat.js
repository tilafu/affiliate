/**
 * Enhanced Chat Features Deployment Script
 * Final setup and deployment of all enhanced chat functionality
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class ChatFeaturesDeployment {
  constructor() {
    this.rootDir = __dirname;
    this.deploymentSteps = [];
  }

  async deploy() {
    console.log('🚀 Starting Enhanced Chat Features Deployment\n');

    try {
      await this.checkPrerequisites();
      await this.integrateScripts();
      await this.createAssetDirectories();
      await this.validateFiles();
      await this.restartServer();
      
      this.printDeploymentSummary();
      
    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    }
  }

  async checkPrerequisites() {
    console.log('📋 Checking prerequisites...');
    
    // Check if required files exist
    const requiredFiles = [
      'server/routes/enhanced-dm-api.js',
      'public/chat/enhanced-chat-features.js',
      'public/chat/enhanced-socket-handlers.js',
      'sql/extend_dm_migration.sql'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.rootDir, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }

    // Check database migration status
    try {
      const { stdout } = await execAsync('node check-database.js');
      if (!stdout.includes('chat_dm_conversations')) {
        console.log('⚠️  Running database migration...');
        await this.runDatabaseMigration();
      }
    } catch (error) {
      console.log('ℹ️  Database check inconclusive, proceeding...');
    }

    this.addStep('✅ Prerequisites checked');
  }

  async runDatabaseMigration() {
    try {
      await execAsync('node run-luxury-migration.ps1');
      this.addStep('✅ Database migration completed');
    } catch (error) {
      console.log('⚠️  Manual database migration may be required');
    }
  }

  async integrateScripts() {
    console.log('🔧 Integrating enhanced scripts...');
    
    try {
      await execAsync('node integrate-chat-features.js');
      this.addStep('✅ Enhanced scripts integrated into HTML pages');
    } catch (error) {
      throw new Error(`Script integration failed: ${error.message}`);
    }
  }

  async createAssetDirectories() {
    console.log('📁 Creating asset directories...');
    
    const directories = [
      'public/chat',
      'public/sounds',
      'public/images/avatars'
    ];

    for (const dir of directories) {
      const dirPath = path.join(this.rootDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }

    // Create default support avatar if it doesn't exist
    const supportAvatarPath = path.join(this.rootDir, 'public/images/avatars/support-agent.png');
    if (!fs.existsSync(supportAvatarPath)) {
      // Copy from default user avatar or create placeholder
      const defaultAvatar = path.join(this.rootDir, 'public/assets/uploads/user.jpg');
      if (fs.existsSync(defaultAvatar)) {
        fs.copyFileSync(defaultAvatar, supportAvatarPath);
      }
    }

    this.addStep('✅ Asset directories created');
  }

  async validateFiles() {
    console.log('🔍 Validating enhanced chat files...');
    
    const validations = [
      this.validateServerIntegration(),
      this.validateFrontendIntegration(),
      this.validateDatabaseSchema()
    ];

    const results = await Promise.allSettled(validations);
    
    let allValid = true;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        this.addStep(`✅ Validation ${index + 1} passed`);
      } else {
        console.log(`⚠️  Validation ${index + 1} failed: ${result.reason}`);
        allValid = false;
      }
    });

    if (!allValid) {
      throw new Error('Some validations failed - check logs above');
    }
  }

  async validateServerIntegration() {
    const serverFile = path.join(this.rootDir, 'server.js');
    if (!fs.existsSync(serverFile)) return false;

    const content = fs.readFileSync(serverFile, 'utf8');
    return content.includes('./routes/enhanced-dm-api') && content.includes('/api/user/chat');
  }

  async validateFrontendIntegration() {
    const testFiles = [
      'public/dashboard.html',
      'public/direct-messages.html'
    ];

    for (const file of testFiles) {
      const filePath = path.join(this.rootDir, file);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf8');
      if (!content.includes('enhanced-chat-features.js') || 
          !content.includes('enhanced-socket-handlers.js')) {
        return false;
      }
    }

    return true;
  }

  async validateDatabaseSchema() {
    try {
      const { stdout } = await execAsync('node check-database.js');
      return stdout.includes('chat_dm_conversations') && 
             stdout.includes('chat_fake_users');
    } catch (error) {
      return false;
    }
  }

  async restartServer() {
    console.log('🔄 Preparing server restart...');
    
    // Check if PM2 is being used
    try {
      const { stdout } = await execAsync('pm2 list');
      if (stdout.includes('affiliate')) {
        console.log('📋 PM2 detected. Run: pm2 restart affiliate');
        this.addStep('ℹ️  PM2 restart command prepared');
        return;
      }
    } catch (error) {
      // PM2 not installed or not running
    }

    // Check for existing server process
    try {
      const { stdout } = await execAsync('netstat -ano | findstr :3000');
      if (stdout) {
        console.log('⚠️  Server appears to be running on port 3000');
        console.log('📋 Please restart your server manually');
        this.addStep('ℹ️  Manual server restart required');
      }
    } catch (error) {
      this.addStep('ℹ️  No server detected on port 3000');
    }
  }

  addStep(message) {
    this.deploymentSteps.push(message);
    console.log(`   ${message}`);
  }

  printDeploymentSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ENHANCED CHAT FEATURES DEPLOYMENT COMPLETE!');
    console.log('='.repeat(60));
    
    console.log('\n📊 Deployment Steps Completed:');
    this.deploymentSteps.forEach(step => console.log(`   ${step}`));
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('   1. Start/restart your server: npm start or pm2 restart affiliate');
    console.log('   2. Navigate to your chat interface');
    console.log('   3. Test the new features:');
    console.log('      • Click fake user avatars in personal groups');
    console.log('      • Use "Help & Support" conversation');
    console.log('      • Check admin notifications display');
    
    console.log('\n🔧 NEW FEATURES ADDED:');
    console.log('   ✅ Fake User Direct Messaging');
    console.log('   ✅ Support Conversation System');
    console.log('   ✅ Enhanced Admin Notifications');
    console.log('   ✅ Real-time Socket.IO Integration');
    console.log('   ✅ Avatar Click Handlers');
    
    console.log('\n📚 API ENDPOINTS AVAILABLE:');
    console.log('   • POST /api/user/chat/fake-user-dm/:id');
    console.log('   • GET/POST /api/user/chat/support');
    console.log('   • GET /api/user/chat/notifications');
    
    console.log('\n🧪 TESTING:');
    console.log('   Run tests: node test-enhanced-chat.js');
    
    console.log('\n' + '='.repeat(60));
  }
}

// Run deployment
async function deploy() {
  const deployment = new ChatFeaturesDeployment();
  await deployment.deploy();
}

// Export for use in other scripts
module.exports = { ChatFeaturesDeployment };

// Run if called directly
if (require.main === module) {
  deploy().catch(console.error);
}
