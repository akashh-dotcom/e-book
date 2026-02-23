#!/usr/bin/env node

/**
 * CLI script to create an admin user.
 *
 * Usage:
 *   node scripts/createAdmin.js
 *
 * It will prompt for username, email, phone, and password interactively.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const readline = require('readline');
const User = require('../models/User');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

(async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/epub-reader';
    await mongoose.connect(uri);
    console.log('\n  VoxBook — Create Admin\n  ─────────────────────\n');

    const username = (await ask('  Username : ')).trim();
    const email    = (await ask('  Email    : ')).trim().toLowerCase();
    const phone    = (await ask('  Phone    : ')).trim();
    const password = (await ask('  Password : ')).trim();

    if (!username || !email || !password) {
      console.log('\n  ✗ Username, email, and password are required.\n');
      process.exit(1);
    }

    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`\n  ✗ A user with email "${email}" already exists.\n`);
      process.exit(1);
    }

    const admin = await User.create({ username, email, phone, password, role: 'admin' });
    console.log(`\n  ✓ Admin created successfully!`);
    console.log(`    ID       : ${admin._id}`);
    console.log(`    Username : ${admin.username}`);
    console.log(`    Email    : ${admin.email}`);
    console.log(`    Role     : ${admin.role}\n`);

    process.exit(0);
  } catch (err) {
    console.error('\n  ✗ Error:', err.message, '\n');
    process.exit(1);
  }
})();
