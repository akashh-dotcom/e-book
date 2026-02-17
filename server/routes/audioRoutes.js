const router = require('express').Router();
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    cb(null, allowed.includes(ext));
  },
});
const ctrl = require('../controllers/audioController');

router.post('/:bookId/:chapterIndex', upload.single('audio'), ctrl.uploadChapterAudio);
router.get('/:bookId/:chapterIndex', ctrl.getChapterAudio);
router.get('/:bookId/:chapterIndex/stream', ctrl.streamAudio);
router.post('/:bookId/:chapterIndex/trim', ctrl.trimAudio);
router.post('/:bookId/:chapterIndex/restore', ctrl.restoreAudio);
router.delete('/:bookId/:chapterIndex', ctrl.deleteChapterAudio);

module.exports = router;
