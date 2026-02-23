const router = require('express').Router();
const ctrl = require('../controllers/translateController');
const { protect } = require('../middleware/auth');

// Public route — supported languages list
router.get('/languages', ctrl.getSupportedLanguages);

// Protected routes
router.use(protect);
router.post('/:bookId/:chapterIndex', ctrl.translateChapter);
router.get('/:bookId/:chapterIndex/progress', ctrl.getProgress);
router.get('/:bookId/:chapterIndex/languages', ctrl.getTranslations);
router.delete('/:bookId/:chapterIndex/:lang', ctrl.deleteTranslation);

module.exports = router;
