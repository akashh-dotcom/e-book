const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  signup, userLogin, adminLogin, getMe,
  updateProfile, changePassword, uploadAvatar, removeAvatar, deleteAccount,
  getAllUsers, deleteUser,
} = require('../controllers/authController');
const { protect, restrictTo } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max for avatars
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

// Public routes
router.post('/signup', signup);
router.post('/login', userLogin);
router.post('/admin/login', adminLogin);

// Protected routes — profile
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/profile/password', protect, changePassword);
router.post('/profile/avatar', protect, upload.single('avatar'), uploadAvatar);
router.delete('/profile/avatar', protect, removeAvatar);
router.delete('/profile', protect, deleteAccount);

// Admin-only routes
router.get('/admin/users', protect, restrictTo('admin'), getAllUsers);
router.delete('/admin/users/:id', protect, restrictTo('admin'), deleteUser);

module.exports = router;
