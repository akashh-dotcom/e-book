const router = require('express').Router();
const ctrl = require('../controllers/annotationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/', ctrl.upsertAnnotation);
router.post('/translate-text', ctrl.translateText);
router.get('/:bookId/:chapterIndex', ctrl.getAnnotations);
router.get('/:bookId', ctrl.getBookAnnotations);
router.delete('/:id', ctrl.deleteAnnotation);

module.exports = router;
