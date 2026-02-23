const User = require('../models/User');
const { signToken } = require('../middleware/auth');

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

    res.status(201).json({
      token,
      user: { id: user._id, username: user.username, email: user.email, phone: user.phone, role: user.role },
    });
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
    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email, phone: user.phone, role: user.role },
    });
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
    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/auth/me — get current user
exports.getMe = async (req, res) => {
  res.json({ user: req.user });
};

// GET /api/auth/admin/users — admin: list all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/auth/admin/users/:id — admin: delete a user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
