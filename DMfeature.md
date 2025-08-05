# Direct Messaging & Support Chat Redesign Plan

## Overview
This plan redesigns the chat system to implement:
1. One-to-one support conversations (replacing group-based support)
2. Direct messaging between users and admin personas
3. Admin notification system for personal groups

## Current System Analysis

### Existing Database Schema
- `chat_groups` - Group information
- `chat_group_members` - User-group relationships  
- `chat_messages` - All messages (group and support)
- `chat_fake_users` - Admin personas/fake users
- `users` - Real registered users

### Current Support System Issues
- Support groups are many-to-many (all users see each other's messages)
- Messages use `support_conversation_user_id` for filtering
- No true isolation between user support conversations

## New Design Requirements

### 1. Support Chat Redesign
**Current**: Many users → One support group → Support team
**New**: One user ↔ One support conversation (isolated)

**Features**:
- Each user gets their own private support conversation
- No avatars in message bubbles (use profile photos in header)
- Complete isolation between different user support chats
- Support appears as "Help & Support" in user's chat list

### 2. Direct Messaging System
**Feature**: Users can click avatars in "Main PEA Communication" group to start DMs

**Requirements**:
- Click user avatar → Opens new private chat
- No message bubble avatars (avatars in chat header only)
- DMs between real users and admin personas
- Admin can manage all DM conversations

### 3. Admin Notification System
**Feature**: Admins send notifications to user's personal group

**Requirements**:
- Appears like message but different styling
- Center-aligned (not left/right)
- Different background color
- No sender avatar/name
- Appears in user's personal group

## Implementation Plan

### Phase 1: Database Schema Updates

#### 1.1 Create Direct Messages Table
```sql
CREATE TABLE direct_messages (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER NOT NULL REFERENCES users(id),
    user2_id INTEGER,  -- NULL for support conversations
    user2_type VARCHAR(20) CHECK (user2_type IN ('real_user', 'fake_user', 'support')),
    fake_user_id INTEGER REFERENCES chat_fake_users(id),
    conversation_type VARCHAR(20) NOT NULL CHECK (conversation_type IN ('support', 'user_dm')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_message_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);
```

#### 1.2 Create DM Messages Table
```sql
CREATE TABLE dm_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('real_user', 'fake_user', 'admin')),
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'link', 'notification')),
    is_notification BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);
```

#### 1.3 Update Chat Messages for Notifications
```sql
ALTER TABLE chat_messages 
ADD COLUMN is_notification BOOLEAN DEFAULT FALSE,
ADD COLUMN notification_style JSONB DEFAULT '{}';
```

#### 1.4 Create Indexes
```sql
CREATE INDEX idx_direct_messages_user1 ON direct_messages(user1_id);
CREATE INDEX idx_direct_messages_user2 ON direct_messages(user2_id, user2_type);
CREATE INDEX idx_direct_messages_type ON direct_messages(conversation_type);
CREATE INDEX idx_dm_messages_conversation ON dm_messages(conversation_id);
CREATE INDEX idx_dm_messages_sender ON dm_messages(sender_id, sender_type);
```

### Phase 2: Backend API Updates

#### 2.1 Support Conversation API
**Endpoint**: `/api/user/chat/support`

**Methods**:
- `GET /api/user/chat/support` - Get or create user's support conversation
- `GET /api/user/chat/support/messages` - Get support messages with pagination
- `POST /api/user/chat/support/messages` - Send message to support

**Questions for Implementation**:
1. Should support conversations be auto-created when user first accesses support?
2. What should be the default "support agent" persona for new conversations?
3. Should there be a timeout for inactive support conversations?

#### 2.2 Direct Messages API
**Endpoints**: `/api/user/chat/direct-messages`

**Methods**:
- `GET /api/user/chat/direct-messages` - List user's DM conversations
- `POST /api/user/chat/direct-messages` - Start new DM with user/persona
- `GET /api/user/chat/direct-messages/:id/messages` - Get DM messages
- `POST /api/user/chat/direct-messages/:id/messages` - Send DM message

**Questions for Implementation**:
1. Should users be able to DM any fake user, or only specific personas?
2. What's the maximum number of simultaneous DM conversations per user?
3. Should DM conversations auto-archive after inactivity?

#### 2.3 Admin DM Management API
**Endpoints**: `/api/admin/chat/direct-messages`

**Methods**:
- `GET /api/admin/chat/direct-messages` - List all DM conversations
- `GET /api/admin/chat/direct-messages/:id` - Get specific DM conversation
- `POST /api/admin/chat/direct-messages/:id/messages` - Send message as persona
- `GET /api/admin/chat/support` - List all support conversations
- `POST /api/admin/chat/support/:id/messages` - Respond to support ticket

#### 2.4 Notification API
**Endpoints**: `/api/admin/chat/notifications`

**Methods**:
- `POST /api/admin/chat/notifications` - Send notification to user's personal group

**Notification Payload**:
```json
{
  "userId": 123,
  "content": "Welcome! Your account has been upgraded to Premium.",
  "notificationStyle": {
    "backgroundColor": "#f0f9ff",
    "textColor": "#0369a1",
    "borderColor": "#38bdf8"
  }
}
```

### Phase 3: Frontend Updates

#### 3.1 Support Chat Interface
**Location**: `public/chat/`

**Changes Needed**:
- Remove group-based support, implement 1-on-1 support
- Remove avatar bubbles in support chat
- Use user's profile photo in chat header
- Update chat list to show "Help & Support" as conversation

**Questions for Implementation**:
1. What should be the default avatar for support agent in header?
2. Should support chat have typing indicators?
3. What's the offline/online status display for support?

#### 3.2 Direct Messages Interface
**New Features**:
- Avatar click handler in "Main PEA Communication" group
- DM conversation list in sidebar
- DM chat interface (no message avatars)
- Chat header with participant avatars

**Questions for Implementation**:
1. Should DM conversations appear in same sidebar as groups?
2. How to handle unread message indicators for DMs?
3. Should there be a search functionality for DM conversations?

#### 3.3 Admin Interface Updates
**Location**: `admin_views/` and related admin chat files

**New Features**:
- DM conversation management panel
- Support ticket queue interface
- Persona selection for DM responses
- Notification sending interface

#### 3.4 Notification Display
**Features**:
- Center-aligned message styling
- Custom background colors
- No sender information
- Different message bubble design

### Phase 4: Real-time Socket.IO Updates

#### 4.1 Support Chat Events
```javascript
// User events
socket.emit('join-support-conversation', conversationId);
socket.emit('support-message', { conversationId, content });

// Admin events  
socket.emit('join-support-queue'); // Join all support conversations
socket.emit('support-response', { conversationId, content, personaId });
```

#### 4.2 Direct Message Events
```javascript
// DM events
socket.emit('join-dm-conversation', conversationId);
socket.emit('dm-message', { conversationId, content });
socket.emit('start-dm', { targetUserId, targetUserType });
```

#### 4.3 Notification Events
```javascript
// Notification events
socket.emit('admin-notification', { userId, content, style });
```

### Phase 5: Data Migration

#### 5.1 Migrate Existing Support Messages
**Script**: `server/migrations/migrate-support-to-dm.js`

**Process**:
1. Identify existing support group messages by `support_conversation_user_id`
2. Create `direct_messages` records for each unique user
3. Migrate messages to `dm_messages` table
4. Update references in frontend

**Questions for Migration**:
1. How to handle existing support messages with multiple participants?
2. Should old support group structure be preserved for historical data?
3. What persona should be assigned to existing support conversations?

#### 5.2 Clean Up Old Schema
**Actions**:
- Remove `support_conversation_user_id` from `chat_messages`
- Deactivate support groups
- Update group member relationships

### Phase 6: Testing Plan

#### 6.1 Support Chat Testing
- [ ] User can access support chat from sidebar
- [ ] Support messages are isolated per user
- [ ] Admin can respond to support tickets
- [ ] Real-time messaging works in support
- [ ] No avatars in message bubbles
- [ ] Profile photos appear in header

#### 6.2 Direct Messages Testing
- [ ] User can click avatar to start DM
- [ ] DM conversations are private
- [ ] Admin can manage DM conversations
- [ ] Multiple DM conversations work simultaneously
- [ ] DM unread indicators function correctly

#### 6.3 Notification Testing
- [ ] Admin can send notifications to personal groups
- [ ] Notifications display with correct styling
- [ ] Notifications are center-aligned
- [ ] No sender information appears
- [ ] Custom background colors work

### Phase 7: Admin Training & Documentation

#### 7.1 Admin Interface Documentation
- How to manage support tickets
- How to respond as different personas
- How to send notifications
- How to monitor DM conversations

#### 7.2 User Guide Updates
- How to access support
- How to start direct messages
- Understanding notification messages

## Questions for Clarification

### Database Design Questions:
1. **Persona Management**: Should each fake_user (persona) have individual message storage, or can we use the current approach with `sender_type` and `sender_id`?

2. **Support Agent Assignment**: Should support conversations be assigned to specific admin users, or can any admin respond?

3. **Message Storage**: Should DM messages and support messages use the same table (`dm_messages`) or separate tables?

4. **Conversation Limits**: Any limits on number of active DM conversations per user?

### UI/UX Questions:
5. **Avatar Sources**: For DMs between users and personas, should we use the fake_user avatar_url for personas and user profile photos for real users?

6. **Notification Styling**: Should notification styles be predefined templates or fully customizable by admins?

7. **Chat Organization**: Should DMs appear in a separate section of the sidebar or mixed with groups?

8. **Support Availability**: Should there be "support hours" or is support always available?

### Technical Implementation Questions:
9. **Real-time Priority**: Should support messages have higher priority for real-time delivery than regular DMs?

10. **Message History**: How long should DM and support message history be retained?

11. **File Sharing**: Should DMs and support chat support file/image sharing?

12. **Search Functionality**: Should users be able to search within DM conversations?

## Implementation Timeline

### Week 1: Database Schema & Migration
- Create new tables
- Write migration scripts
- Test data migration

### Week 2: Backend API Development
- Support conversation API
- Direct messages API
- Notification API

### Week 3: Frontend Updates
- Support chat interface
- DM interface
- Avatar click handlers

### Week 4: Admin Interface
- DM management panel
- Support ticket queue
- Notification system

### Week 5: Real-time Integration
- Socket.IO event handlers
- Real-time message delivery
- Typing indicators

### Week 6: Testing & Refinement
- End-to-end testing
- Performance optimization
- Bug fixes

### Week 7: Documentation & Training
- Admin documentation
- User guides
- Team training

## Success Metrics

1. **Support Efficiency**: Reduced response time for support tickets
2. **User Engagement**: Increased DM usage between users and personas
3. **Privacy**: Zero cross-contamination between support conversations
4. **Admin Productivity**: Faster notification delivery to users
5. **User Satisfaction**: Improved chat experience feedback

## Risk Mitigation

1. **Data Loss Prevention**: Comprehensive backup before migration
2. **Rollback Plan**: Ability to revert to current system if needed
3. **Gradual Rollout**: Phase-wise deployment with user groups
4. **Performance Monitoring**: Real-time monitoring during deployment
5. **User Communication**: Clear communication about system changes

---

This plan provides a comprehensive roadmap for implementing the new DM and support chat system while maintaining data integrity and user experience.

