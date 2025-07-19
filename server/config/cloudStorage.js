const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
});

// S3 storage configuration for avatars
const avatarS3Storage = multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
    key: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `avatars/user-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
        cb(null, {
            fieldName: file.fieldname,
            userId: req.user.id.toString(),
            uploadedAt: new Date().toISOString()
        });
    }
});

// Production-ready avatar upload with S3
const productionAvatarUpload = multer({
    storage: avatarS3Storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Stricter validation
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const allowedExts = /\.(jpg|jpeg|png|webp)$/i;
        
        if (allowedMimes.includes(file.mimetype) && allowedExts.test(file.originalname)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
        }
    }
});

module.exports = {
    productionAvatarUpload,
    s3
};
