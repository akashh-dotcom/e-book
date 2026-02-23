const express = require('express');
const router = express.Router();
const { signup, userLogin, adminLogin, getMe, getAllUsers, deleteUser } = require('../controllers/authController');
const { protect, restrictTo } = require('../middleware/auth');

// Public routes
router.post('/signup', signup);           // User registration only
router.post('/login', userLogin);         // User login
router.post('/admin/login', adminLogin);  // Admin login

// Protected routes
router.get('/me', protect, getMe);

// Admin-only routes
router.get('/admin/users', protect, restrictTo('admin'), getAllUsers);
router.delete('/admin/users/:id', protect, restrictTo('admin'), deleteUser);

module.exports = router;
