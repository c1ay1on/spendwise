const router = require('express').Router();
const multer = require('multer');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const wrap = require('../utils/asyncHandler');
const { parseId } = require('../utils/validate');
const { saveReceipt, getReceiptUrl, deleteReceipt } = require('../services/storage');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },                 // 10 MB, same as the Nginx limit
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimetype)) return cb(null, true);
    const err = new Error('Only jpg, png or pdf files are allowed');
    err.status = 400;
    cb(err);
  }
});

// The browser's mimetype can be faked, so also check the first bytes of the file.
function hasAllowedSignature(buf) {
  const hex = buf.subarray(0, 4).toString('hex');
  return hex.startsWith('ffd8ff') || hex === '89504e47' || hex === '25504446';   // jpg, png, pdf
}

router.post('/:id/receipt', auth, upload.single('receipt'), wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Expense not found' });

  const [rows] = await pool.query('SELECT receipt_key FROM expenses WHERE id = ? AND user_id = ?', [id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Expense not found' });

  if (!req.file) return res.status(400).json({ error: 'No file uploaded (the field name must be "receipt")' });
  if (!hasAllowedSignature(req.file.buffer)) return res.status(400).json({ error: 'File is not a valid jpg, png or pdf' });

  const key = await saveReceipt(req.user.id, req.file);
  await pool.query('UPDATE expenses SET receipt_key = ? WHERE id = ? AND user_id = ?', [key, id, req.user.id]);

  if (rows[0].receipt_key) {                                // replacing an old receipt: remove it
    try { await deleteReceipt(rows[0].receipt_key); } catch (e) { console.error('Old receipt cleanup failed:', e.name); }
  }
  res.json({ has_receipt: true });
}));

router.get('/:id/receipt', auth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Expense not found' });

  const [rows] = await pool.query('SELECT receipt_key FROM expenses WHERE id = ? AND user_id = ?', [id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Expense not found' });
  if (!rows[0].receipt_key) return res.status(404).json({ error: 'This expense has no receipt' });

  res.json({ url: await getReceiptUrl(rows[0].receipt_key) });
}));

module.exports = router;
