/**
 * Enhanced Chat Features Test Script
 * Tests all new functionality: fake user DMs, support conversations, notifications
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  testUserId: 1,
  testFakeUserId: 1,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key'
};

// Generate test auth token
function generateTestToken(userId = TEST_CONFIG.testUserId) {
  return jwt.sign(
    { 
      userId: userId,
      email: `test${userId}@example.com`,
      role: 'user'
    },
    TEST_CONFIG.jwtSecret,
    { expiresIn: '1h' }
  );
}

// Test suite for enhanced chat features
class EnhancedChatTests {
  constructor() {
    this.authToken = generateTestToken();
    this.results = [];
  }

  async runAllTests() {
    console.log('🚀 Starting Enhanced Chat Features Tests\n');
    
    await this.testFakeUserDMCreation();
    await this.testSupportConversation();
    await this.testNotificationAPIs();
    await this.testDatabaseIntegrity();
    
    this.printResults();
  }

  async testFakeUserDMCreation() {
    console.log('📝 Testing Fake User DM Creation...');
    
    try {
      // Test creating DM with fake user
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/user/chat/fake-user-dm/${TEST_CONFIG.testFakeUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.addResult('✅ Fake User DM Creation', 'PASS', `Created conversation ID: ${data.conversation?.id}`);
        
        // Test sending message to fake user DM
        await this.testSendMessageToFakeUserDM(data.conversation.id);
      } else {
        this.addResult('❌ Fake User DM Creation', 'FAIL', `HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      this.addResult('❌ Fake User DM Creation', 'ERROR', error.message);
    }
  }

  async testSendMessageToFakeUserDM(conversationId) {
    try {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/user/chat/fake-user-dm/${TEST_CONFIG.testFakeUserId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({
          content: 'Test message to fake user DM'
        })
      });

      if (response.ok) {
        this.addResult('✅ Send Message to Fake User DM', 'PASS', 'Message sent successfully');
      } else {
        this.addResult('❌ Send Message to Fake User DM', 'FAIL', `HTTP ${response.status}`);
      }
    } catch (error) {
      this.addResult('❌ Send Message to Fake User DM', 'ERROR', error.message);
    }
  }

  async testSupportConversation() {
    console.log('🆘 Testing Support Conversation...');
    
    try {
      // Test getting support conversation
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/user/chat/support`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.addResult('✅ Support Conversation Retrieval', 'PASS', `Conversation ID: ${data.conversation?.id}`);
        
        // Test sending support message
        await this.testSendSupportMessage();
        
        // Test getting support messages
        await this.testGetSupportMessages();
      } else {
        this.addResult('❌ Support Conversation Retrieval', 'FAIL', `HTTP ${response.status}`);
      }
    } catch (error) {
      this.addResult('❌ Support Conversation Retrieval', 'ERROR', error.message);
    }
  }

  async testSendSupportMessage() {
    try {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/user/chat/support/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({
          content: 'Test support message - need help with my account'
        })
      });

      if (response.ok) {
        this.addResult('✅ Send Support Message', 'PASS', 'Support message sent successfully');
      } else {
        this.addResult('❌ Send Support Message', 'FAIL', `HTTP ${response.status}`);
      }
    } catch (error) {
      this.addResult('❌ Send Support Message', 'ERROR', error.message);
    }
  }

  async testGetSupportMessages() {
    try {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/user/chat/support/messages`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.addResult('✅ Get Support Messages', 'PASS', `Retrieved ${data.messages?.length || 0} messages`);
      } else {
        this.addResult('❌ Get Support Messages', 'FAIL', `HTTP ${response.status}`);
      }
    } catch (error) {
      this.addResult('❌ Get Support Messages', 'ERROR', error.message);
    }
  }

  async testNotificationAPIs() {
    console.log('🔔 Testing Notification APIs...');
    
    try {
      // Test getting notifications
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/user/chat/notifications`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.addResult('✅ Get Notifications', 'PASS', `Retrieved ${data.notifications?.length || 0} notifications`);
      } else {
        this.addResult('❌ Get Notifications', 'FAIL', `HTTP ${response.status}`);
      }
    } catch (error) {
      this.addResult('❌ Get Notifications', 'ERROR', error.message);
    }
  }

  async testDatabaseIntegrity() {
    console.log('🗄️  Testing Database Integrity...');
    
    try {
      // Test database connection and structure
      const { Pool } = require('pg');
      const pool = new Pool({
        user: process.env.DB_USER || 'affiliate_user',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'affiliate_db',
        password: process.env.DB_PASSWORD || 'affiliate123',
        port: process.env.DB_PORT || 5432,
      });

      // Test required tables exist
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('chat_dm_conversations', 'chat_dm_messages', 'chat_fake_users')
      `;
      
      const tablesResult = await pool.query(tablesQuery);
      const requiredTables = ['chat_dm_conversations', 'chat_dm_messages', 'chat_fake_users'];
      const existingTables = tablesResult.rows.map(row => row.table_name);
      
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));
      
      if (missingTables.length === 0) {
        this.addResult('✅ Database Tables', 'PASS', 'All required tables exist');
        
        // Test required columns exist
        await this.testDatabaseColumns(pool);
      } else {
        this.addResult('❌ Database Tables', 'FAIL', `Missing tables: ${missingTables.join(', ')}`);
      }
      
      await pool.end();
    } catch (error) {
      this.addResult('❌ Database Connection', 'ERROR', error.message);
    }
  }

  async testDatabaseColumns(pool) {
    try {
      const columnsQuery = `
        SELECT column_name, table_name
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'chat_dm_conversations'
        AND column_name IN ('user2_type', 'fake_user_id', 'conversation_type')
      `;
      
      const columnsResult = await pool.query(columnsQuery);
      const requiredColumns = ['user2_type', 'fake_user_id', 'conversation_type'];
      const existingColumns = columnsResult.rows.map(row => row.column_name);
      
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
      
      if (missingColumns.length === 0) {
        this.addResult('✅ Database Columns', 'PASS', 'All required columns exist');
      } else {
        this.addResult('❌ Database Columns', 'FAIL', `Missing columns: ${missingColumns.join(', ')}`);
      }
    } catch (error) {
      this.addResult('❌ Database Columns', 'ERROR', error.message);
    }
  }

  addResult(test, status, details) {
    this.results.push({ test, status, details });
    console.log(`   ${test}: ${status} - ${details}`);
  }

  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const errors = this.results.filter(r => r.status === 'ERROR').length;
    
    console.log(`✅ PASSED: ${passed}`);
    console.log(`❌ FAILED: ${failed}`);
    console.log(`⚠️  ERRORS: ${errors}`);
    console.log(`📊 TOTAL:  ${this.results.length}`);
    
    if (failed > 0 || errors > 0) {
      console.log('\n🔍 ISSUES FOUND:');
      this.results
        .filter(r => r.status !== 'PASS')
        .forEach(result => {
          console.log(`   ${result.test}: ${result.details}`);
        });
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// Frontend integration test
function testFrontendIntegration() {
  console.log('\n🌐 Testing Frontend Integration...');
  
  const fs = require('fs');
  const path = require('path');
  
  const chatPages = [
    'public/dashboard.html',
    'public/account.html',
    'public/direct-messages.html'
  ];
  
  let allPagesIntegrated = true;
  
  chatPages.forEach(pageFile => {
    const filePath = path.join(__dirname, pageFile);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      const hasEnhancedFeatures = content.includes('enhanced-chat-features.js');
      const hasSocketHandlers = content.includes('enhanced-socket-handlers.js');
      
      if (hasEnhancedFeatures && hasSocketHandlers) {
        console.log(`   ✅ ${pageFile}: Fully integrated`);
      } else {
        console.log(`   ❌ ${pageFile}: Missing ${!hasEnhancedFeatures ? 'features' : ''}${!hasSocketHandlers ? ' socket-handlers' : ''}`);
        allPagesIntegrated = false;
      }
    } else {
      console.log(`   ⚠️  ${pageFile}: File not found`);
    }
  });
  
  return allPagesIntegrated;
}

// Run tests
async function runTests() {
  const tester = new EnhancedChatTests();
  await tester.runAllTests();
  
  const frontendIntegrated = testFrontendIntegration();
  
  if (frontendIntegrated) {
    console.log('\n🎉 All enhanced chat features are ready for testing!');
    console.log('\n📋 Manual Testing Checklist:');
    console.log('   1. ✅ Start your server: npm start');
    console.log('   2. ✅ Login to a user account');
    console.log('   3. ✅ Navigate to personal group chat (Main PEA Communication)');
    console.log('   4. ✅ Click on fake user avatars to start DMs');
    console.log('   5. ✅ Check "Help & Support" conversation in sidebar');
    console.log('   6. ✅ Send messages in support conversation');
    console.log('   7. ✅ Verify admin notifications appear center-aligned');
    console.log('   8. ✅ Test real-time updates with Socket.IO');
  }
}

// Export for use in other scripts
module.exports = { EnhancedChatTests, testFrontendIntegration };

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}
