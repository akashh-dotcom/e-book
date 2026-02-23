const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:    { type: String, default: '' },
  password: { type: String, required: true, minlength: 6 },
  role:     { type: String, enum: ['user', 'admin'], default: 'user' },
  avatar:   { type: String, default: '' }, // filename in storage/avatars/

  // Stripe subscription fields
  plan:                 { type: String, enum: ['starter', 'pro', 'enterprise'], default: 'starter' },
  stripeCustomerId:     { type: String, default: '' },
  stripeSubscriptionId: { type: String, default: '' },
  subscriptionStatus:   { type: String, default: '' }, // e.g. active, trialing, past_due, canceled
  currentPeriodEnd:     { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
