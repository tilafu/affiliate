# Direct Message (DM) Feature Workplan

## 1. Database Schema Changes

### Tables
- **chat_dm_conversations**
  - id (PK)
  - user_id_1 (FK to users or fake_users)
  - user_id_2 (FK to users or fake_users)
  - created_at
  - last_message_at
  - UNIQUE(user_id_1, user_id_2) -- enforce one conversation per pair

- **chat_dm_messages**
  - id (PK)
  - conversation_id (FK to chat_dm_conversations)
  - sender_id (FK to users or fake_users)
  - message (text)
  - message_type (text, image, file, voicenote)
  - attachment_url (nullable)
  - created_at
  - is_read (boolean)

## 2. Backend API Endpoints & Routing

### Endpoints
- `GET /api/admin-chat/dms` — List DM conversations for current user (admin/fake user/real user)
- `GET /api/admin-chat/dms/:conversationId` — Get messages in a DM conversation
- `POST /api/admin-chat/dms` — Start a new DM conversation (enforce uniqueness)
- `POST /api/admin-chat/dms/:conversationId/message` — Send a message (support attachments)
- `DELETE /api/admin-chat/dms/:conversationId` — Delete a DM conversation

### Middleware
- **Auth Middleware**: Checks if user is admin, fake user, or real user. Only authenticated users can access DM endpoints.
- **Permission Middleware**:
  - Real users: Can only access their own DMs.
  - Admins: Can access/search all DMs, respond as fake users.
  - Fake users: Can access their own DMs.
- **File Upload Middleware**: Handles image/file/voicenote uploads, stores files securely, returns URLs.

### Routing Logic
- On DM creation, check for existing conversation between user pairs (enforce uniqueness).
- On message send, handle text and file uploads, store message and attachment URL.
- On DM list, filter conversations by participant (unless admin).
- On DM delete, remove conversation and all messages (no special requirements).

## 3. Frontend Changes

### UI Components
- DM conversation list (sidebar/tab)
- DM chat window (WhatsApp-like)
- New DM button
- Message input (text, file/image/voicenote upload)
- Unread badge/count

### API Integration
- Add DM methods to `admin-chat-api.js`:
  - listDMConversations()
  - getDMConversation(conversationId)
  - startDMConversation(userId)
  - sendDMMessage(conversationId, message, type, attachment)
  - deleteDMConversation(conversationId)
- State management for DM conversations/messages
- Badge updates for unread messages

## 4. Authentication & Permissions
- Only authenticated users (admin, fake, real) can use DMs
- DMs visible only to participants (except admin, who can see all)
- Admins can search all DMs, respond as fake users

## 5. Notifications
- Unread DM badge/count per conversation
- Notification for new DM messages (badge update on API call)

## 6. Implementation Steps
1. Update DB schema, add tables and constraints
2. Implement backend routes, middleware, and file upload handling
3. Add DM API methods to frontend client
4. Build DM UI components
5. Integrate unread badge logic
6. Test end-to-end (admin, fake user, real user)

---
This workplan covers schema, backend, frontend, middleware, routing, and notification logic for the DM feature.
