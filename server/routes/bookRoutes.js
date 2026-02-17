const router = require('express').Router();
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.epub')) cb(null, true);
    else cb(new Error('Only .epub files allowed'));
  },
});
const ctrl = require('../controllers/bookController');

// Book routes
router.post('/upload', upload.single('epub'), ctrl.upload);
router.get('/', ctrl.listBooks);
router.get('/:id', ctrl.getBook);
router.get('/:id/chapters/:index', ctrl.getChapter);
router.get('/:id/search', ctrl.searchBook);
router.delete('/:id', ctrl.deleteBook);

// Bookmark routes
router.post('/bookmarks', ctrl.createBookmark);
router.get('/bookmarks/:bookId', ctrl.getBookmarks);
router.delete('/bookmarks/item/:id', ctrl.deleteBookmark);

module.exports = router;
