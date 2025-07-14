
# Direct Message (DM) Feature Workplan (Redesign)

## 1. Database Schema Changes

### Tables

- **chat_dm_conversations**
  - `id` (PK)
  - `user_id_1` (FK to users.id, can be real, admin, or fake user)
  - `user_id_2` (FK to users.id, can be real, admin, or fake user)
  - `created_at`
  - `last_message_at`
  - `UNIQUE(user_id_1, user_id_2)` — ensures one DM per user pair

- **chat_dm_messages**
  - `id` (PK)
  - `conversation_id` (FK to chat_dm_conversations.id)
  - `sender_id` (FK to users.id)
  - `message` (text)
  - `message_type` (text, image, file, voicenote)
  - `attachment_url` (nullable)
  - `created_at`
  - `is_read` (boolean)

**Note:**
- All users (real, admin, fake) are in the `users` table. Use the `role` column for filtering and permissions.
- No duplicate or non-existent relations; all FKs reference `users.id`.

## 2. Backend API Endpoints & Routing

### Endpoints

- `GET /api/admin-chat/dms`  
  List DM conversations for the current user (admin, fake, or real user).

- `GET /api/admin-chat/dms/:conversationId`  
  Get messages in a DM conversation.

- `POST /api/admin-chat/dms`  
  Start a new DM conversation (enforce uniqueness).

- `POST /api/admin-chat/dms/:conversationId/message`  
  Send a message (supports attachments).

- `DELETE /api/admin-chat/dms/:conversationId`  
  Delete a DM conversation.

- `GET /api/admin-chat/fake-users/:fakeUserId/messages`  
  Get all group and DM messages for a fake user (for admin oversight).

### Middleware

- **Auth Middleware:**  
  Ensures only authenticated users (admin, fake, real) access DM endpoints.

- **Permission Middleware:**  
  - Real users: Only their own DMs.
  - Admins: Can view/search all DMs, respond as fake users.
  - Fake users: Only their own DMs.

- **File Upload Middleware:**  
  Handles image/file/voicenote uploads, stores files securely, returns URLs.

### Routing Logic

- On DM creation, check for existing conversation between user pairs.
- On message send, handle text and file uploads, store message and attachment URL.
- On DM list, filter conversations by participant (unless admin).
- On DM delete, remove conversation and all messages.

## 3. Frontend Changes

### UI Components

- DM conversation list (sidebar/tab)
- DM chat window (WhatsApp-like)
- New DM button
- Message input (text, file/image/voicenote upload)
- Unread badge/count
- Admin: Select fake user to view all their messages (group + DM)

### API Integration

- Add DM methods to `admin-chat-api.js`:
  - `listDMConversations()`
  - `getDMConversation(conversationId)`
  - `startDMConversation(userId)`
  - `sendDMMessage(conversationId, message, type, attachment)`
  - `deleteDMConversation(conversationId)`
  - `getFakeUserMessages(fakeUserId)` (admin only)
- State management for DM conversations/messages
- Badge updates for unread messages

## 4. Authentication & Permissions

- Only authenticated users (admin, fake, real) can use DMs.
- DMs visible only to participants (except admin, who can see all).
- Admins can search all DMs, respond as fake users, and view all messages for any fake user.

## 5. Notifications

- Unread DM badge/count per conversation.
- Notification for new DM messages (badge update on API call).

## 6. Implementation Steps

1. Update DB schema, add tables and constraints.
2. Implement backend routes, middleware, and file upload handling.
3. Add DM API methods to frontend client.
4. Build DM UI components.
5. Integrate unread badge logic.
6. Add admin view for fake user message history.
7. Test end-to-end (admin, fake user, real user).

---
This redesign ensures all relations exist in your database, avoids duplication, and supports both DM and group chat features with robust admin oversight.

**Note:** All users (real, admin, fake) are stored in the `users` table. The `role` column in `users` distinguishes user types and should be used for permission logic and filtering.

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
