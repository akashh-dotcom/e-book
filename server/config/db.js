const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    // Migrate: drop old SyncData unique index that lacks the lang field
    try {
      const col = mongoose.connection.collection('syncdatas');
      const indexes = await col.indexes();
      const oldIdx = indexes.find(
        i => i.key?.bookId && i.key?.chapterIndex && !i.key?.lang && i.unique
      );
      if (oldIdx) {
        await col.dropIndex(oldIdx.name);
        console.log('Dropped old SyncData index (added lang dimension)');
      }
    } catch (e) {
      // Index may not exist yet — safe to ignore
    }
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
