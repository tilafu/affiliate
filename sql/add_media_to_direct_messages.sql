-- Add media support to direct messages
ALTER TABLE direct_message_texts 
ADD COLUMN IF NOT EXISTS media_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS media_type VARCHAR(50);

-- Update the content column to allow NULL (for media-only messages)
ALTER TABLE direct_message_texts 
ALTER COLUMN content DROP NOT NULL;

-- Add a constraint to ensure either content or media_url is present
ALTER TABLE direct_message_texts 
ADD CONSTRAINT check_content_or_media 
CHECK (content IS NOT NULL OR media_url IS NOT NULL);
