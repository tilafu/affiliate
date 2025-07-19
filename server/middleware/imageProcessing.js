const sharp = require('sharp');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// Rate limiting for avatar uploads
const avatarUploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // Limit each user to 3 avatar uploads per 15 minutes
    message: {
        error: 'Too many avatar uploads. Please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `avatar_upload_${req.user.id}` // Rate limit per user
});

// Image processing and security validation
async function processAndValidateImage(buffer, mimetype) {
    try {
        // Security: Check for malicious files
        const magicNumbers = {
            'image/jpeg': [0xFF, 0xD8, 0xFF],
            'image/png': [0x89, 0x50, 0x4E, 0x47],
            'image/webp': [0x52, 0x49, 0x46, 0x46]
        };

        const fileHeader = Array.from(buffer.slice(0, 4));
        const expectedHeader = magicNumbers[mimetype];
        
        if (!expectedHeader || !expectedHeader.every((byte, index) => byte === fileHeader[index])) {
            throw new Error('File type validation failed - possible security threat');
        }

        // Process image with Sharp
        const processedImage = await sharp(buffer)
            .resize(300, 300, {
                fit: 'cover',
                position: 'center'
            })
            .jpeg({ 
                quality: 85,
                progressive: true,
                mozjpeg: true
            })
            .toBuffer();

        return {
            buffer: processedImage,
            size: processedImage.length,
            format: 'jpeg'
        };

    } catch (error) {
        throw new Error(`Image processing failed: ${error.message}`);
    }
}

// Generate secure filename
function generateSecureFilename(userId, originalExtension) {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    return `avatar_${userId}_${timestamp}_${randomBytes}.jpg`;
}

module.exports = {
    avatarUploadLimiter,
    processAndValidateImage,
    generateSecureFilename
};
