const path = require('path');
const fs = require('fs').promises;
const User = require('../models/User');
const { signToken } = require('../middleware/auth');

// Helper: build user response object
const userResponse = (u) => ({
  id: u._id, username: u.username, email: u.email, phone: u.phone, role: u.role,
  avatar: u.avatar ? `/storage/avatars/${u.avatar}` : '',
});

// POST /api/auth/signup — users only
exports.signup = async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const user = await User.create({ username, email, phone, password, role: 'user' });
    const token = signToken(user);

    res.status(201).json({ token, user: userResponse(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/auth/login — for regular users
exports.userLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email, role: 'user' });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    res.json({ token, user: userResponse(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/auth/admin/login — for admins only
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email, role: 'admin' });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const token = signToken(user);
    res.json({ token, user: userResponse(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/auth/me — get current user
exports.getMe = async (req, res) => {
  res.json({ user: userResponse(req.user) });
};

// PUT /api/auth/profile — update username, email, phone
exports.updateProfile = async (req, res) => {
  try {
    const { username, email, phone } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (email && email !== user.email) {
      const dup = await User.findOne({ email });
      if (dup) return res.status(409).json({ error: 'Email already in use' });
      user.email = email;
    }
    if (username) user.username = username;
    if (phone !== undefined) user.phone = phone;

    await user.save();
    res.json({ user: userResponse(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/auth/profile/password — change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords are required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const user = await User.findById(req.user._id);
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/auth/profile/avatar — upload profile photo
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Delete old avatar file if exists
    if (user.avatar) {
      const oldPath = path.join(__dirname, '..', 'storage', 'avatars', user.avatar);
      await fs.unlink(oldPath).catch(() => {});
    }

    // Save new avatar
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const filename = `${user._id}-${Date.now()}${ext}`;
    const destPath = path.join(__dirname, '..', 'storage', 'avatars', filename);
    await fs.writeFile(destPath, req.file.buffer);

    user.avatar = filename;
    await user.save();

    res.json({ user: userResponse(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/auth/profile/avatar — remove profile photo
exports.removeAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.avatar) {
      const filePath = path.join(__dirname, '..', 'storage', 'avatars', user.avatar);
      await fs.unlink(filePath).catch(() => {});
      user.avatar = '';
      await user.save();
    }

    res.json({ user: userResponse(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/auth/profile — delete own account
exports.deleteAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Remove avatar file
    if (user.avatar) {
      const filePath = path.join(__dirname, '..', 'storage', 'avatars', user.avatar);
      await fs.unlink(filePath).catch(() => {});
    }

    await User.deleteOne({ _id: user._id });
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/auth/admin/users — admin: list all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users: users.map(u => ({ ...u.toObject(), avatar: u.avatar ? `/storage/avatars/${u.avatar}` : '' })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/auth/admin/users/:id — admin: delete a user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.avatar) {
      const filePath = path.join(__dirname, '..', 'storage', 'avatars', user.avatar);
      await fs.unlink(filePath).catch(() => {});
    }

    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
