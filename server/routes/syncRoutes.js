const router = require('express').Router();
const ctrl = require('../controllers/syncController');
const { protect } = require('../middleware/auth');

// All sync routes require authentication
router.use(protect);

router.post('/:bookId/:chapterIndex/auto', ctrl.autoAlign);
router.post('/:bookId/:chapterIndex/manual', ctrl.saveManualSync);
router.get('/:bookId/:chapterIndex', ctrl.getSyncData);
router.get('/:bookId/status', ctrl.getSyncStatus);
router.delete('/:bookId/:chapterIndex', ctrl.deleteSyncData);

module.exports = router;
