const router = require('express').Router();
const ctrl = require('../controllers/syncController');

router.post('/:bookId/:chapterIndex/auto', ctrl.autoAlign);
router.post('/:bookId/:chapterIndex/manual', ctrl.saveManualSync);
router.get('/:bookId/:chapterIndex', ctrl.getSyncData);
router.get('/:bookId/status', ctrl.getSyncStatus);
router.delete('/:bookId/:chapterIndex', ctrl.deleteSyncData);

module.exports = router;
