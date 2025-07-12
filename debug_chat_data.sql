-- Debug Chat System - Check what was actually created
-- Run this to see the actual IDs and data in your chat tables

-- Check chat groups with their actual IDs
SELECT 'CHAT GROUPS:' as section;
SELECT id, name, group_type, is_active, created_by, created_at 
FROM chat_groups 
ORDER BY id;

-- Check fake users with their actual IDs  
SELECT 'FAKE USERS:' as section;
SELECT id, username, display_name, is_active, created_by, created_at 
FROM chat_fake_users 
ORDER BY id;

-- Check group members and their relationships
SELECT 'GROUP MEMBERS:' as section;
SELECT cgm.id, cgm.group_id, cg.name as group_name, 
       cgm.fake_user_id, cfu.username, cgm.user_type, cgm.join_date
FROM chat_group_members cgm
JOIN chat_groups cg ON cgm.group_id = cg.id
JOIN chat_fake_users cfu ON cgm.fake_user_id = cfu.id
ORDER BY cgm.group_id, cgm.fake_user_id;

-- Check messages
SELECT 'MESSAGES:' as section;
SELECT cm.id, cm.group_id, cg.name as group_name, 
       cm.fake_user_id, cfu.username, 
       LEFT(cm.message, 50) || '...' as message_preview,
       cm.created_at
FROM chat_messages cm
JOIN chat_groups cg ON cm.group_id = cg.id
JOIN chat_fake_users cfu ON cm.fake_user_id = cfu.id
ORDER BY cm.group_id, cm.created_at;

-- Check if there are any real users in the system (for admin authentication)
SELECT 'ADMIN USERS:' as section;
SELECT id, username, role, is_active, created_at 
FROM users 
WHERE role IN ('admin', 'super_admin') 
ORDER BY id;

-- Final summary
SELECT 'SUMMARY:' as section;
SELECT 
    (SELECT COUNT(*) FROM chat_groups) as total_groups,
    (SELECT COUNT(*) FROM chat_fake_users) as total_fake_users,
    (SELECT COUNT(*) FROM chat_group_members) as total_memberships,
    (SELECT COUNT(*) FROM chat_messages) as total_messages,
    (SELECT COUNT(*) FROM users WHERE role IN ('admin', 'super_admin')) as total_admins;
